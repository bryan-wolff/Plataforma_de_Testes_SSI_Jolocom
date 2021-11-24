/* ............... Configuração do Servidor ............... */

const porta = 80
import express from "express";
const app = express()
import bodyParser from 'body-parser';
app.use(bodyParser.urlencoded({ extended: true }))


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
    database: './database/mitmDB.sql',
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
const API = await sdk.loadAgent(passwordAPI, "did:jolo:da4b434d035cb43c652bb6fa98ec7ef09680047955db3d0957ddc6c6bd87befd")

console.log(`Agente Criado/Carregado (API): ${API.identityWallet.did}`)

// -----------> CLIENT

const passwordClient = 'secretpasswordClient'

//Criação de um agente com uma identidade aleatória
//const client = await sdk.createAgent(passwordClient, 'jolo') 

//Carregando uma identidade existente
const client = await sdk.loadAgent(passwordClient, "did:jolo:a359148202b9aa27424c324ba7cc4ebba373d5f76efbbee2a4b20d0ab4d5a4a7")

console.log(`Agente Criado/Carregado (Cliente): ${client.identityWallet.did}`)

/* ............... Metadados de credenciais ............... */

const credUnicampMetadata = {
    type: ['Credential', 'credencialUNICAMP'],
    name: 'Credencial UNICAMP',
    context: [
        {
        SimpleExample: 'https://example.com/terms/credencialUNICAMP',
        schema: 'https://schema.org/',
        cpf: 'schema:cpf',
        nomeCompleto: 'schema:nomeCompleto',
        RA: 'schema:RA',
        email: 'schema:email',
        primeiroNome: 'schema:primeiroNome',
        sobrenome: 'schema:sobrenome',
        nascimento: 'schema:nascimento',
        },
    ],
}

import { claimsMetadata } from '@jolocom/protocol-ts'

/* ............... Configurando as requisições HTTP ............... */

// ----------> Fluxo de VERIFICAÇÃO de credencial

//get em /api/credentialRequests gerará uma solicitaçao de credencial
app.get('/api/credentialRequests', async function (req, res, next) {
    console.log("\nAPI: Requisição GET")

    try {
        const credentialReques = await API.credRequestToken({
            callbackURL: 'https://example.com/request',
            credentialRequirements: [
              {
                type: ['ProofOfEmailCredential'],
                constraints: [],
              },
            ],
        })
        const enc = credentialReques.encode()
        //setTimeout(() => res.send(enc), 3000)
        res.send(enc)
        console.log("SUCESSO! Solicitação de credencial criada e enviada")
    
    } catch (error) {
        console.log("ERRO na geração da solicitação de credencial")
        console.log(error)
        res.send("ERRO na geração da solicitação de credencial")
    }
})

//post em /client/credentialRequests (em body) deve conter a solicitaçao de credencial através da key 'response'
app.post('/client/credentialRequests', async function (req, res, next) {
    console.log("\nCliente: Requisição POST")

    try {
        const clientInteraction = await client.processJWT(req.body.response)

        const clientResponse = await clientInteraction.createCredentialResponse([
          'claimId:668aa3c9cf770c21', //id da credencial no armazenamento
        ])
        const enc = clientResponse.encode()
        console.log("SUCESSO! Resposta da solicitação de credencial criada e enviada")

        res.send(enc)

    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de de credencial para a solicitação de credencial assinada e válida pelos padrões jolocom!")
    }
})

//post em /api/credentialRequests (em body) deve conter a resposta da solicitaçao do cliente através da key 'response'    
app.post('/api/credentialRequests', async function (req, res, next) {
    console.log("\nAPI: Requisição POST")

    try {
        //const APIInteraction = await API.processJWT(req.body.response)

        const providedCredentials = await JolocomLib.parse.interactionToken.fromJWT(req.body.response).interactionToken.suppliedCredentials
        const signatureValidationResults = await JolocomLib.util.validateDigestables(providedCredentials)
        if (!signatureValidationResults.includes(false)) {
            console.log("SUCESSO! a credencial fornecida é válida!")
            res.send("SUCESSO! a credencial fornecida é válida!")
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
            callbackURL: 'https://example.com/issuance',
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

//post em /client/credentialIssuance (em body) deve conter a oferta de credencial que será trasmitiada para o cliente através da key 'response'    
app.post('/client/credentialIssuance', async function (req, res, next) {
    console.log("\nCliente: Requisição POST")

    try {
        const clientInteraction = await client.processJWT(req.body.response)
        const clientResponse = await clientInteraction.createCredentialOfferResponseToken(
        [{ type: 'ProofOfEmailCredential'}],
        )

        const enc = clientResponse.encode()
        res.send(enc)
        console.log("SUCESSO! Resposta da oferta de credencial gerada e enviada")

    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça oferta de credencial válida!")
    }

})

//post em /api/credentialIssuance (em body) deve conter a resposta da oferta do cliente através da key 'response'    
app.post('/api/credentialIssuance', async function (req, res, next) {
    console.log("\nAPI: Requisição POST")

    try {
        const APIInteraction = await API.processJWT(req.body.response)

        const emailAddressSignedCredential = await API.signedCredential({
            metadata:  claimsMetadata.emailAddress,
            subject: client.identityWallet.did,
            claim: {
                email: 'example@example.com',
            },
        })
        /*
        const emailAddressSignedCredential = await API.identityWallet.create.signedCredential({
            metadata: claimsMetadata.emailAddress, //gera metadados fornecidos pelo pacote @jolocom/protocol-ts
            claim: { email: 'example@email.com' },
            subject: client.identityWallet.did, // deve-se usar o did do cliente e o email dele
          }, 
        passwordAPI, 
        //customExpiryDate se não estiver presente, o padrão será 1 ano a partir de Date.now()
        )*/

        const APIIssuance = await APIInteraction.createCredentialReceiveToken([
            emailAddressSignedCredential,
        ])

        const enc = APIIssuance.encode()
	    console.log("SUCESSO! Credencial gerada e enviada!!!")
        res.send(enc)
        
    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça uma resposta de oferta de credencial assinada e válida pelos padrões jolocom!")
    }
})

//post em /client/credentialReceiver (em body) deve conter o token de credencial emitida pela API através da key 'response'    
app.post('/client/credentialReceiver', async function (req, res, next) {
    console.log("\nCliente: Requisição POST")

    try {
        const receivedCredentials = await JolocomLib.parse.interactionToken.fromJWT(req.body.response).interactionToken.signedCredentials
        const signatureValidationResults = await JolocomLib.util.validateDigestables(receivedCredentials)
        if (!signatureValidationResults.includes(false)) {
            console.log("SUCESSO! a credencial emitida é válida e será armazenada!")
            res.send("SUCESSO! a credencial emitida é válida e será armazenada!")
            receivedCredentials.map(VC => client.storage.store.verifiableCredential(VC))
        }
        else {
            res.send("ERRO:  a credencial emitida não é válida!")
            res.send("ERRO: a credencial emitida não é válida!")
        }
        
       /*
        const clientReceives = await client.processJWT(req.body.response)

        const state = clientReceives.getSummary().state
        console.log(state)
        if (state.credentialsAllValid === true) {
            await Promise.all(state.issued.map(VC => client.storage.store.verifiableCredential(VC)))
            console.log("SUCESSO! A credencial recebida é Válida A credencial foi armazenada!")
            res.send("SUCESSO! A credencial recebida é Válida! A credencial foi armazenada!")
        } 
        else{
            console.log("ERRO! A credencial recebida é não é Válida!")
            res.send("ERRO! A credencial recebida é não é Válida!")
        }
        
        */

    } catch (error) {
        console.log("ERRO: ", error)
        res.send("ERRO: Forneça token de credencial válido!")
    }

})


/* ............... Iniciando Servidor ............... */

console.log("\nIniciando Servidor...")

app.listen(porta, () => {
    console.log(`Servidor está executando na porta ${porta}.`)
    console.log()
})