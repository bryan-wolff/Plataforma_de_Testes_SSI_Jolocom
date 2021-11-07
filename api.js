/* ............... Configuração do Servidor ............... */

const porta = 7777
import express from "express";
const app = express()
import bodyParser from 'body-parser';
app.use(bodyParser.urlencoded({ extended: true }))
import fetch from 'node-fetch'
const URL_BASE = `http://wolff.gleeze.com:${porta}` //`http://issuer-jolocom.gidlab.rnp.br:${porta}`

/* ............... DEPENDENCIAS JOLOCOM ............... */

import { JolocomSDK, NaivePasswordStore, JolocomLib } from '@jolocom/sdk'
import { JolocomTypeormStorage } from '@jolocom/sdk-storage-typeorm'
import { SoftwareKeyProvider } from '@jolocom/vaulted-key-provider'
import { createConnection } from 'typeorm'
import * as WebSocket from 'ws'

/* ............... back-end de Armazenamento ............... */

const typeOrmConfig = {
    name: 'demoDb',
    type: 'sqlite',
    database: './mydb.sql',
    dropSchema: false,
    entities: ['node_modules/@jolocom/sdk-storage-typeorm/js/src/entities/*.js'],
    synchronize: true,
    logging: false,
  }
  
  const connection = await createConnection(typeOrmConfig)
  const sdk = new JolocomSDK({
    storage: new JolocomTypeormStorage(connection),
  })

/* ............... instanciando SDK ............... */

sdk.transports.ws.configure({ WebSocket })

/* ............... Inicializando agentes ............... */

console.log("\nCriando/Carregando Agentes...")

// -----------> API

const passwordAPI = 'secretpasswordAPI'

//Criação de um agente com uma identidade aleatória
//const API = await sdk.createAgent(passwordAPI, 'jolo') 

//Carregando uma identidade existente
const API = await sdk.loadAgent(passwordAPI, "did:jolo:762e41643998bca0d9df37eef96a9404f308d751bb352ddce7b600c18f75b65c")

console.log(`Agente Criado/Carregado (API): ${API.identityWallet.did}`)

/* ............... Metadados de credenciais ............... */

const StudentCredentialUNICAMPMetadata = {
    type: ['Credential', 'StudentCredentialUNICAMP'],
    name: 'Student Credential UNICAMP',
    context: [
        {
        StudentCredentialUNICAMP: 'https://example.com/terms/StudentCredentialUNICAMP',
        schema: 'https://schema.org/',
        cpf: 'schema:cpf',
        fullName: 'schema:Fullname',
        RA: 'schema:RA',
        email: 'schema:email',
        familyName: 'schema:familyName',
        givenName: 'schema:givenName',
        birthDate: 'schema:birthDate',
        },
    ],
}

import { claimsMetadata } from '@jolocom/protocol-ts'

/* ............... Configurando as requisições HTTP ............... */

app.use(function(req, res, next){
    var data = "";
    req.on('data', function(chunk){ data += chunk})
    req.on('end', function(){
       req.rawBody = data;
       next();
    })
        // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    
 })



// ----------> Fluxo de VERIFICAÇÃO de credencial

//get em /authenticate gerará uma solicitaçao de credencial do tipo 'ProofOfEmailCredential'
app.get('/authenticate', async function (req, res, next) {
    console.log("\nAPI: Requisição GET")

    try {
        const credentialRequest = await API.credRequestToken({
            callbackURL: `${URL_BASE}/authenticate`,
            credentialRequirements: [
              {
                type: ['Credential','ProofOfEmailCredential'],
                constraints: [],
              },
            ],
        })
        const enc = credentialRequest.encode()
        res.send({token:enc, identifier: credentialRequest.payload.jti})

        console.log("SUCESSO! Solicitação de credencial criada e enviada")
    
    } catch (error) {
        console.log("ERRO na geração da solicitação de credencial")
        console.log(error)
        res.send("ERRO na geração da solicitação de credencial")
    }
})

//post em /authenticate deve conter a resposta da solicitaçao do cliente através da key 'token'    
app.post('/authenticate', async function (req, res, next) {
    console.log("\nAPI: Requisição POST")
    const token = JSON.parse(req.rawBody).token

    //const response = JSON.parse(Object.keys(req.body)[0]).response
    try {
        //const APIInteraction = await API.processJWT(req.body.response)
        const interaction =  await JolocomLib.parse.interactionToken.fromJWT(token)
        const providedCredentials = interaction.interactionToken.suppliedCredentials
        const signatureValidationResults = await JolocomLib.util.validateDigestables(providedCredentials)
        if (!signatureValidationResults.includes(false)) {
            console.log("SUCESSO! a credencial fornecida pelo client é válida!")
            cache[interaction.payload.jti].authenticated = true
            cache[interaction.payload.jti].expiryTime = Date.now() + 30000
            cache[interaction.payload.jti].claim = providedCredentials[0].claim
            //cache[interaction.payload.jti].claims = providedCredentials
            res.send("SUCESSO! a credencial fornecida é válida!")
            //res.send(!signatureValidationResults.includes(false))
        }

        else {
            console.log("ERRO: Forneça uma resposta de credencial assinada e válida pelos padrões jolocom!")
            res.send("ERRO: Forneça uma resposta de credencial assinada e válida pelos padrões jolocom!")
        }

    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de credencial assinada e válida pelos padrões jolocom!")
    }

})

// ----------> Fluxo de EMISSÃO de credencial ProofOfEmailCredential

//get em /receive/ProofOfEmailCredential gerará uma oferta de credencial do tipo ProofOfEmailCredential
app.get('/receive/ProofOfEmailCredential', async function (req, res, next) {
    console.log("\nAPI: Requisição GET")

    try {
        const credentialOffer  = await API.credOfferToken({
            callbackURL: `${URL_BASE}/receive/ProofOfEmailCredential`,
            offeredCredentials: [
              {
                type: 'ProofOfEmailCredential',
              },
            ],
        })
        const enc = credentialOffer.encode()
        res.send({token:enc, identifier:credentialOffer.payload.jti})
        console.log("SUCESSO! Oferta de credencial criada e enviada")

    } catch (error) {
        console.log("ERRO na geração da oferta de credencial")
        console.log(error)
        res.send("ERRO na geração da oferta de credencial")
    }
})

//post em /receive/ProofOfEmailCredential deve conter a resposta da oferta do cliente através da key 'token'    
app.post('/receive/ProofOfEmailCredential', async function (req, res, next) {
    console.log("\nAPI: Requisição POST")

    const token = JSON.parse(req.rawBody).token

    //const response = JSON.parse(Object.keys(req.body)[0]).response

    try {
        const APIInteraction = await API.processJWT(token)
        /*
        const emailAddressSignedCredential = await API.signedCredential({
            metadata:  claimsMetadata.emailAddress,
            subject: APIInteraction.messages[1].payload.iss.split('#')[0],
            claim: {
                email: 'A012345@dac.unicamp.br',
            },
        })*/
        
        const emailAddressSignedCredential = await API.identityWallet.create.signedCredential({
            metadata: claimsMetadata.emailAddress, //gera metadados fornecidos pelo pacote @jolocom/protocol-ts
            claim: { email: 'A012345@dac.unicamp.br' },
            subject: APIInteraction.messages[1].payload.iss.split('#')[0], // deve-se usar o did do cliente e o email dele
          }, 
        passwordAPI, 
        //customExpiryDate se não estiver presente, o padrão será 1 ano a partir de Date.now()
        )

        const APIIssuance = await APIInteraction.createCredentialReceiveToken([
            emailAddressSignedCredential,
        ])

        const enc = APIIssuance.encode()

        console.log(`
        token gerado:
        
        ${enc}

        `)

	    console.log("SUCESSO! Credencial gerada e enviada!!!")
        res.send(enc)
        
    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de oferta de credencial assinada e válida pelos padrões jolocom!")
    }
})



// ----------> Fluxo de EMISSÃO de credencial StudentCredentialUNICAMP

/*
//get em /receive/StudentCredentialUNICAMP gerará uma oferta de credencial do tipo StudentCredentialUNICAMP
app.get('/receive/StudentCredentialUNICAMP', async function (req, res, next) {
    console.log("\nAPI: Requisição GET")

    try {
        const credentialOffer  = await API.credOfferToken({
            callbackURL: `${URL_BASE}/receive/StudentCredentialUNICAMP`,
            offeredCredentials: [
              {
                type: 'StudentCredentialUNICAMP',
              },
            ],
        })
        const enc = credentialOffer.encode()
        res.send({token:enc, identifier:credentialOffer.payload.jti})
        console.log("SUCESSO! Oferta de credencial criada e enviada")

    } catch (error) {
        console.log("ERRO na geração da oferta de credencial")
        console.log(error)
        res.send("ERRO na geração da oferta de credencial")
    }
})

//post em /receive/StudentCredentialUNICAMP deve conter a resposta da oferta do cliente através da key 'token'    
app.post('/receive/StudentCredentialUNICAMP', async function (req, res, next) {
    console.log("\nAPI: Requisição POST")

    const token = JSON.parse(req.rawBody).token

    try {
        const APIInteraction = await API.processJWT(token)

        const credentialUNICAMP = await API.identityWallet.create.signedCredential({
            metadata: StudentCredentialUNICAMPMetadata,
            subject: APIInteraction.messages[1].payload.iss.split('#')[0],
            claim: {
                cpf: '123.456.789-12',
                fullName: 'Lorem Ipsum',
                RA: '123456',
                email: 'l000000@dac.unicamp.br',
                familyName: 'Ipsum',
                givenName: 'Lorem',
                birthDate: '01/01/2001',
            },
        }, passwordAPI)

        const APIIssuance = await APIInteraction.createCredentialReceiveToken([
            credentialUNICAMP,
        ])

        const enc = APIIssuance.encode()

        console.log(`
        token gerado:
        
        ${enc}

        `)

	    console.log("SUCESSO! Credencial gerada e enviada!!!")
        res.send(enc)
        
    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de oferta de credencial assinada e válida pelos padrões jolocom!")
    }
})
*/

// ----------> Fluxo de Auntenticação

const cache = {}

app.get('/', async (req, res) => {
  try {
    const ip = req.ip == "::1" ? "127.0.0.1":req.ip.split(':')[3] || req.connection.remoteAddress.split(':')[3]

    let alreadyAuthenticated = false
    let IDalreadyAuthenticated = "null"

    Object.keys(cache).forEach(key => {
        if (cache[key].ip == ip && cache[key].authenticated == true) {
            alreadyAuthenticated = true
            IDalreadyAuthenticated = key
        }
    })

    if (alreadyAuthenticated == true) {
        res.redirect("/" + IDalreadyAuthenticated) 
        alreadyAuthenticated = false
        IDalreadyAuthenticated = "null"
    } else {

        const response = await fetch(`${URL_BASE}/authenticate`).then(res => res.text()).then(res => JSON.parse(res))

        const token = response.token
        const identifier = response.identifier
    
        cache[identifier] = {ip: ip, authenticated: false, token: token, expiryToken: Date.now() + 120000}
        res.redirect("/" + identifier) 
    }

  } catch (error) {
    res.send(error)
  }
})

app.get('/:id', (req, res) => {
  
  try {
    const ip = req.ip == "::1" ? "127.0.0.1":req.ip.split(':')[3] || req.connection.remoteAddress.split(':')[3]
    
    if (cache[req.params.id] == undefined) {
      res.redirect('/')
    } else {

        if (cache[req.params.id].authenticated === true) {

            if (cache[req.params.id].ip === ip) {
                //res.sendFile('index.html', {root: __dirname })
                res.send('Usuário Autenticado!')
                
            } else {
                res.redirect("/")
            }
          
    
        } else { //***** qnd não é o mesmo ip mas ja foi autenticado, ele reconstroi um qrcode invalido pois ja foi processado
          //fazer autenticação e direcionar o usuário para /:id 
          const newURL = `${URL_BASE}/${req.params.id}`
          res.send(`<!doctype html><head><style>* {text-align:center;}body { padding:20px;}.qr-btn { background-color:#8c52ff; padding:8px; color:white; cursor:pointer;}.token {margin-left: 30%;margin-right: 30%;word-break: break-all; overflow: scroll;}</style><title>SSI Authenticator</title></head><body><h3>Please scan the QR code with your Jolocom SmartWallet to provide your e-mail credential</h3> <br/><textarea id="token" rows="4" cols="50">${cache[req.params.id].token}</textarea><br/><br/> <canvas id="qr-code"></canvas> <br/><br/><br/><div> <button class="qr-btn" onclick=window.location="${newURL}">Continue</button> </div> <script src="https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js"></script><script>/* JS comes here */var qr;(function() { qr = new QRious({ element: document.getElementById('qr-code'), size: 400, value: '${cache[req.params.id].token}' }); })();</script> </body></html>`) 
          
        }

    }

  } catch (error) {
    res.send(error)
  }
})

//a cada 20 segundos verifica expiryTime de algum usuário, e se expirou, o usuário é removido do cache e necessitará fazer um novo login 
//também é verificado se o usuário demorou 2min para se autenticar, neste caso, o usuário é removido do cache e necessitará fazer mais uma tentativa de login 

setInterval(e => {
    Object.keys(cache).forEach(key => {
        if (cache[key].expiryTime < Date.now() & cache[key].authenticated == true) {
            console.log(`\nAutenticação do usuário ${key} expirado\n`)
            delete cache[key]
        }

        if (cache[key].expiryToken < Date.now() & cache[key].authenticated == false) {
            console.log(`\nToken de autenticação do usuário ${key} expirado\n`)
            delete cache[key]
        }
        //console.log(cache)
    })
},20000)



/* ............... Iniciando Servidor ............... */

console.log("\nIniciando Servidor...")

app.listen(porta, () => {
    console.log(`Servidor está executando em ${URL_BASE}`)
    console.log()
})