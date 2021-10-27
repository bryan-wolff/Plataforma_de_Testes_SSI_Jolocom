/* ............... Configuração do Servidor ............... */

const porta = 80
import express from "express";
const app = express()
import bodyParser from 'body-parser';
app.use(bodyParser.urlencoded({ extended: true }))
import fetch from 'node-fetch'


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

const credUnicampMetadata = {
    type: ['Credential', 'credencialUNICAMP'],
    name: 'Credential UNICAMP',
    context: [
        {
        credencialUNICAMP: 'https://example.com/terms/credencialUNICAMP',
        schema: 'https://schema.org/',
        cpf: 'schema:cpf',
        nomeCompleto: 'schema:name',
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

//get em /api/credentialRequests gerará uma solicitaçao de credencial
app.get('/api/credentialRequests', async function (req, res, next) {
    console.log("\nAPI: Requisição GET")

    try {
        const credentialRequest = await API.credRequestToken({
            callbackURL: 'http://issuer-jolocom.gidlab.rnp.br/api/credentialRequests',
            credentialRequirements: [
              {
                type: ['Credential','ProofOfEmailCredential'],
                constraints: [],
              },
            ],
        })
        const enc = credentialRequest.encode()
        res.send(enc)

        console.log("SUCESSO! Solicitação de credencial criada e enviada")
    
    } catch (error) {
        console.log("ERRO na geração da solicitação de credencial")
        console.log(error)
        res.send("ERRO na geração da solicitação de credencial")
    }
})

//post em /api/credentialRequests (em body) deve conter a resposta da solicitaçao do cliente através da key 'response'    
app.post('/api/credentialRequests', async function (req, res, next) {
    console.log("\nAPI: Requisição POST")
    const token = JSON.parse(req.rawBody).token

    //const response = JSON.parse(Object.keys(req.body)[0]).response
    try {
        //const APIInteraction = await API.processJWT(req.body.response)

        const providedCredentials = await JolocomLib.parse.interactionToken.fromJWT(token).interactionToken.suppliedCredentials
        const signatureValidationResults = await JolocomLib.util.validateDigestables(providedCredentials)
        if (!signatureValidationResults.includes(false)) {
            console.log("SUCESSO! a credencial fornecida pelo client é válida!")
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

// ----------> Fluxo de EMISSÃO de credencial

//get em /api/credentialIssuance gerará uma oferta de credencial do tipo ProofOfEmailCredential
app.get('/api/credentialIssuance', async function (req, res, next) {
    console.log("\nAPI: Requisição GET")

    try {
        const credentialOffer  = await API.credOfferToken({
            callbackURL: 'http://issuer-jolocom.gidlab.rnp.br/api/credentialIssuance',
            offeredCredentials: [
              {
                type: 'ProofOfEmailCredential',
              },
            ],
        })
        const enc = credentialOffer.encode()
        res.send(enc)
        console.log("SUCESSO! Oferta de credencial criada e enviada")

    } catch (error) {
        console.log("ERRO na geração da oferta de credencial")
        console.log(error)
        res.send("ERRO na geração da oferta de credencial")
    }
})

//post em /api/credentialIssuance (em body) deve conter a resposta da oferta do cliente através da key 'response'    
app.post('/api/credentialIssuance', async function (req, res, next) {
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

        console.log(enc)

	    console.log("SUCESSO! Credencial gerada e enviada!!!")
        res.send(enc)
        
    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de oferta de credencial assinada e válida pelos padrões jolocom!")
    }
})


/* ............... Iniciando Servidor ............... */

console.log("\nIniciando Servidor...")

app.listen(porta, () => {
    console.log(`Servidor está executando na porta ${porta}.`)
    console.log()
})