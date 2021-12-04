/* ............... DEPENDENCIAS do Servidor ............... */

import {porta, URL_BASE} from "../config.js"
import express, { response } from "express";
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
import { claimsMetadata } from '@jolocom/protocol-ts'
import { SoftwareKeyProvider } from "@jolocom/vaulted-key-provider";


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
    
    console.log('\nUm novo cliente foi conectado!')

    ws.on('message', async function message(data) {

        const response = JSON.parse(data)

        console.log(`\nmensagem de um cliente WS recebida: ${response.messageType}`)

        if (response.messageType == "authenticationRequired") {
            const tokenJSON = await fetch(`${URL_BASE}/authenticate`).then(res => res.text()).then(res => JSON.parse(res))
            ws.identifier = tokenJSON.identifier
            const response = {messageType: "authenticationToken", payload: tokenJSON}
            ws.send(JSON.stringify(response))
        } 
        
        else if (response.messageType == "issuanceRequired") {
            const tokenJSON = await fetch(`${URL_BASE}/receive/ProofOfEmailCredential`).then(res => res.text()).then(res => JSON.parse(res))
            ws.identifier = tokenJSON.identifier
            const response = {messageType: "issuanceToken", payload: tokenJSON}
            ws.send(JSON.stringify(response))
        }

        else if (response.messageType == "email") {
            ws.email = response.payload.email
        }
        
    });

})


/* ............... AGENTES ............... */

console.log("\nCriando/Carregando Agentes...")

const passwordAPI = 'secretpasswordAPI'

//Criação de um agente com uma identidade aleatória
//const API = await sdk.createAgent(passwordAPI, 'jolo') 

//Carregando uma identidade existente
const API = await sdk.loadAgent(passwordAPI, "did:jolo:762e41643998bca0d9df37eef96a9404f308d751bb352ddce7b600c18f75b65c")

console.log(`Agente Criado/Carregado (API): ${API.identityWallet.did}`)

//criar um perfil com informações publicas: https://jolocom-lib.readthedocs.io/en/latest/publicProfile.html

/* .............................. Configurando as requisições HTTP .............................. */

app.use(function(req, res, next){
    var data = "";
    req.on('data', function(chunk){ data += chunk})
    req.on('end', function(){
       req.rawBody = data;
       next();
    })
    // Site que você deseja permitir a conexão
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Métodos que você deseja permitir
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); //, OPTIONS, PUT, PATCH, DELETE

    // Cabeçalhos que deseja permitir
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Definido como verdadeiro se você precisar que o site inclua cookies nas solicitações enviadas
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

    try {

        const interaction =  await JolocomLib.parse.interactionToken.fromJWT(token)
        const providedCredentials = interaction.interactionToken.suppliedCredentials
        const signatureValidationResults = await JolocomLib.util.validateDigestables(providedCredentials)
        if (!signatureValidationResults.includes(false)) {
            console.log("SUCESSO! a credencial fornecida pelo client é válida!")
            res.send("SUCESSO! a credencial fornecida é válida!")
            wss.clients.forEach(function each(client) {
                if (client.identifier == interaction.payload.jti & client.readyState === WebSocket.OPEN) {
                    const resposta = {messageType: "successfullyAuthenticated", payload: providedCredentials[0].claim}
                    resposta.payload.issuer = providedCredentials[0].issuer
                    client.send(JSON.stringify(resposta))
                }
            })
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
                renderInfo: {
                    renderAs: "document",
                },
                credential: {
                    name: "Email Address",
                    display: {
                      properties: [
                        {
                          path: [ 
                            "$.email" //contem o nome referente a key da claim
                          ],
                          label: "Email", 
                          //value: "your email"
                        },
                      ]
                    }
                },
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

        var emailClaim;

        wss.clients.forEach(function each(client) {
            if (client.identifier == APIInteraction.messages[1].payload.jti & client.readyState === WebSocket.OPEN) {
                emailClaim = client.email
            }
        })
        
        const emailAddressSignedCredential = await API.identityWallet.create.signedCredential({
            metadata: claimsMetadata.emailAddress, //gera metadados fornecidos pelo pacote @jolocom/protocol-ts
            claim: { email: emailClaim},
            subject: APIInteraction.messages[1].payload.iss.split('#')[0], // deve-se usar o did do cliente e o email dele
          }, 
        passwordAPI, 
        //customExpiryDate se não estiver presente, o padrão será 1 ano a partir de Date.now()
        )

        const APIIssuance = await APIInteraction.createCredentialReceiveToken([
            emailAddressSignedCredential,
        ])

        const enc = APIIssuance.encode()

        wss.clients.forEach(function each(client) {
            if (client.identifier == APIIssuance.payload.jti & client.readyState === WebSocket.OPEN) {
                const resposta = {messageType: "successfullyIssued", payload: {token:enc}}
                client.send(JSON.stringify(resposta))
            }
        })

	    console.log("SUCESSO! Credencial gerada e enviada!!!")
        res.send(enc)
        
    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de oferta de credencial assinada e válida pelos padrões jolocom!")
    }
})

/* ............... Front-End para o Fluxo de VERIFICAÇÃO ............... */

app.get('/login', function(req, res) {
    res.sendFile(path.resolve('./public/login.html'));
});

/* ............... Front-End para o Fluxo de EMISSÃO ............... */

app.get('/issuer', function(req, res) {
    res.sendFile(path.resolve('./public/issuer.html'));
});

/* ............... Iniciando Servidor ............... */

console.log("\nIniciando Servidor...")

server.listen(porta, () => {
    console.log(`Servidor está executando em ${URL_BASE}`)
    console.log()
})