/* ............... DEPENDENCIAS do Servidor ............... */

import {porta, URL_BASE} from "../config.js"
import express from "express";
const app = express()
import bodyParser from 'body-parser';
app.use(bodyParser.urlencoded({ extended: true }))
import fetch from 'node-fetch'
import * as http from 'http'
const server = http.createServer(app)
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'


/* ............... DEPENDENCIAS JOLOCOM ............... */

import { JolocomSDK, NaivePasswordStore, JolocomLib } from '@jolocom/sdk'
import { JolocomTypeormStorage } from '@jolocom/sdk-storage-typeorm'
import { createConnection } from 'typeorm'


/* ............... back-end de Armazenamento ............... */

const typeOrmConfig = {
    name: 'demoDb',
    type: 'sqlite',
    database: './database/apiDB.sql',
    dropSchema: false,
    entities: ['node_modules/@jolocom/sdk-storage-typeorm/js/src/entities/*.js'],
    synchronize: true,
    logging: false,
  }
  
  const connection = await createConnection(typeOrmConfig)
  const sdk = new JolocomSDK({
    storage: new JolocomTypeormStorage(connection),
  })


/* ............... Websocket ............... */

const wss = new WebSocketServer({server})

wss.on('connection', async function connection(ws, req) {
    
    console.log('Um novo Cliente foi conectado!')

    const tokenJSON = await fetch(`${URL_BASE}/authenticate`).then(res => res.text()).then(res => JSON.parse(res))

    ws.identifier = tokenJSON.identifier

    const response = {messageType: "credentialRequirements", payload: tokenJSON}

    ws.send(JSON.stringify(response))

})


/* ............... AGENTES ............... */

console.log("\nCriando/Carregando Agentes...")

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


/* .............................. Configurando as requisições HTTP .............................. */

//app.use('/config.js', express.static(path.resolve('./config.js')));

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); //, OPTIONS, PUT, PATCH, DELETE

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    
 })


/* ............... Requisições refente ao fluxo de VERIFICAÇÃO (ProofOfEmailCredential) ............... */

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
            res.send("SUCESSO! a credencial fornecida é válida!")
            wss.clients.forEach(function each(client) {
                if (client.identifier == interaction.payload.jti & client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({messageType: "credentialValid", payload: providedCredentials[0].claim}))
                }
            })
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

/* ............... Requisições refente ao fluxo de EMISSÃO (ProofOfEmailCredential) ............... */

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


/* ............... Front-End para o Fluxo de VERIFICAÇÃO ............... */

app.get('/', function(req, res) {
    res.sendFile(path.resolve('./public/index.html'));
});

/* ............... Iniciando Servidor ............... */

console.log("\nIniciando Servidor...")

server.listen(porta, () => {
    console.log(`Servidor está executando em ${URL_BASE}`)
    console.log()
})