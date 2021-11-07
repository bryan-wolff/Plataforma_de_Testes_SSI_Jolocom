import fetch from 'node-fetch'
import promptSync from 'prompt-sync';
const prompt = promptSync({sigint: true});

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

// -----------> CLIENT

const passwordClient = 'secretpasswordClient'

/*
//Criação de um agente com uma identidade aleatória
console.log("\nIniciando a criação de um agente com uma identidade aleatória...\n")
const client = await sdk.createAgent(passwordClient, 'jolo') 
console.log(`Agente criado (client): ${client.identityWallet.did}\n`)
*/


//Carregando uma identidade existente
console.log("\nCarregando um agente a partir do armazenamento...\n")
const client = await sdk.loadAgent(passwordClient, "did:jolo:3ea2ef04122979b277813bdba8d07d44c1760a8629f9447091ba2440247039ba")
console.log(`Agente carregado (Cliente): ${client.identityWallet.did} \n`)

/* ............... Fluxo de Verificação (acesso à um SP) ............... */

await client.storage.delete.verifiableCredential('claimId:dd6221c27ab8e288')

async function acessarAPI(URL = 'http://issuer-jolocom.gidlab.rnp.br/authenticate') {

    console.log("\nIniciando Fluxo de VERIFICAÇÃO de CV...\n")

    try {
        console.log(`Acessando SP em: ${URL}\n`)

        var solicitacao = await fetch(URL)
        .then(res => res.text())
        .catch(err => console.log(err))
        
        solicitacao = JSON.parse(solicitacao)

        console.log("SP solicitou credenciais!\n")
    }
    catch (error) {
        console.log("ERRO: Houve algum erro ao acessar o SP")
        console.log("ERRO: ", error)
    }

    try {
        console.log(solicitacao.token)
        const clientInteraction = await client.processJWT(solicitacao.token)
        
        console.log("Tipo(s) de CV(s) requisitada(as): \n")

        const typeCV = []
        clientInteraction.getMessages()[0].payload.interactionToken.credentialRequirements.forEach(element => {
            console.log("--->", element.type[1])
            typeCV.push(element.type[1])
        });

        console.log("\nEscolha a credencial a ser trasmitida!\n") //(EX: 668aa3c9cf770c21 )

        const input = prompt('claimId:');
        const chosenCV = 'claimId:'.concat(input)

        console.log(`\nCV Escolhida: ${chosenCV} \n`);

        console.log("Criando resposta (incluido CVs necessárias)...\n")
        const clientResponse = await clientInteraction.createCredentialResponse([
            chosenCV,//'claimId:668aa3c9cf770c21', //id da credencial no armazenamento
        ])
        
        const enc = clientResponse.encode()

        console.log("Enviando resposta para o SP...\n")
        await fetch(clientResponse.payload.interactionToken.callbackURL, {
            method: 'POST',
            body: JSON.stringify({"token": enc}),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.text())
        .then(acess => console.log(acess, "\n"))
        .catch(err => console.log(err))

    } catch (error) {
        console.log("ERRO: Houve algum erro durante o processo de verificação de credencial")
        console.log("ERRO: ", error)
    }

}


/* ............... Fluxo de Emissão ............... */

async function emitirCVs(URL = 'http://issuer-jolocom.gidlab.rnp.br/receive/ProofOfEmailCredential') {

    console.log("\nIniciando Fluxo de EMISSÃO de CV...\n")
    
    try {
        console.log(`Acessando o serviço emissor de CV em: ${URL}\n`)
        var oferta = await fetch(URL)
            .then(res => res.text())
            .catch(err => console.log(err))
            console.log("Emissor respondeu com uma oferta contendo os tipos de credenciais que pode emitir!\n")
        
        oferta = JSON.parse(oferta)
    
    } catch (error) {
        console.log("ERRO: Houve algum erro ao acessar a API")
        console.log("ERRO: ", error)
    }
    
    try {
    
        const clientInteraction = await client.processJWT(oferta.token)
    
        console.log("Tipo(s) de CV(s) que pode(m) ser emitida(s): \n")

        const typeCV = []

        clientInteraction.getMessages()[0].interactionToken.offeredCredentials.forEach(element => {
            console.log("--->", element.type)
            typeCV.push(element.type)
        });
        
        console.log("\nEscolha pelo menos um tipo de credencial desejada das descritas acima!")
        console.log("OBS: em caso de multiplas CVs, separe-as por espaço!  EX: credType1 credType2 credType3")
        console.log("OBS: caso queira escolher todas, pressione Enter!\n")

        const input = prompt('Tipos desejados: ');
        const chosenCV = input == "" ? typeCV : input.split(" ")

        console.log(`\nTipo(s) de CV(s) escolhida(s): ${chosenCV}\n`);

        console.log("Criando resposta (incluido os tipos CVs desejadas)...\n")

        const CVsTypes = []

        chosenCV.forEach(element =>{
            CVsTypes.push({ type: element })
        })

        const clientResponse = await clientInteraction.createCredentialOfferResponseToken(
            CVsTypes,
        )
    
        const enc = clientResponse.encode()

        console.log("Enviando resposta para o Emissor...")
        var responseAPIWithCVs = await fetch(clientResponse.payload.interactionToken.callbackURL, {
            method: 'POST',
            body: JSON.stringify({"token": enc}),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.text())
          .catch(err => console.log(err))

    
    } catch (error) {
        console.log("ERRO: Houve algum erro na criação/transmissão da resposta...")
        console.log("ERRO: ", error)
    }
    
    
    try {

        const receivedCredentials = await JolocomLib.parse.interactionToken.fromJWT(responseAPIWithCVs).interactionToken.signedCredentials

        console.log("\nEmissor respondeu com as CVs emitidas!\n")
    
        console.log("Iniciando verificação da autenticidade das CVs recebidas (com apoio da Blockchain)...\n")

        const signatureValidationResults = await JolocomLib.util.validateDigestables(receivedCredentials)
    
        if (!signatureValidationResults.includes(false)) {
            console.log("SUCESSO! a credencial emitida é válida e será armazenada!\n")
            receivedCredentials.map(VC => client.storage.store.verifiableCredential(VC))
        }
        else {
            console.log("ERRO: a credencial emitida não é válida!\n")
        }
        
    } catch (error) {
        console.log("ERRO: Houve algum erro ao receber/validar as CVs emitidas...")
        console.log("ERRO: ", error)
    }
  
}

console.log("---> Cliente Inicializado!!!\n")


var state = true

while (state) {

    console.log(">> Página Inicial:\n")

    console.log(`Digite o número da tarefa que deseja realizar:

    0 - exit (or ctrl+C)
    1 - Acessar SP (será solicitado uma CV)
    2 - Acessar Emissor (emitir CV)
    3 - Deletar Credenciais do BD
    `)

    const input = parseInt(prompt("Número da tarefa: "))

    switch (input) {
        case 0:
            console.log("\nEncerrando Client...\n")
            state = false
            break;

        case 1:
            await acessarAPI()
            console.log("Fluxo Concluído! Retomando à página inicial... \n")
            break;

        case 2:
            await emitirCVs()
            console.log("Fluxo Concluído! Retomando à página inicial... \n")
            break;

        case 3:
            console.log("\nDigite o ID da CV que deseja deletar!\n")
            const newInput= prompt('claimId:');
            const chosenCV = 'claimId:'.concat(newInput)
            await client.storage.delete.verifiableCredential(chosenCV)
            console.log("\nFluxo Concluído! Retomando à página inicial... \n")
            break;
    
        default:
            break;
    }

}
