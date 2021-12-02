# Plataforma de Testes de Gestão de Identidades Autossoberana Baseada no Protocolo Jolocom

## Introdução 

A Identidade Autossoberana (SSI) é um padrão emergente baseado em [Identidades Descentralizadas](https://w3c.github.io/did-core/) e [Credenciais Verificáveis](https://w3c.github.io/vc-data-model/) que surgiu da necessidade dos usuários terem controle absoluto e exclusivo de seus dados, que no ecossistema atual estão centralizados e em posse de terceiros. Essa nova arquitetura contribui para melhorias de privacidade e diminuição dos riscos de vazamentos. Este projeto objetiva estudar, por meio de várias análises e experimentações, uma das principais soluções SSI - [Jolocom](https://jolocom.io/wp-content/uploads/2019/12/Jolocom-Whitepaper-v2.1-A-Decentralized-Open-Source-Solution-for-Digital-Identity-and-Access-Management.pdf).

Esta implementação faz uso da ferramenta [Jolocom SDK](https://jolocom.github.io/jolocom-sdk/1.0.0/).

#### Projeto Financiado pelo Programa de Gestão de Identidades PGID 2021

---

## Configurando a Plataforma

Para poder instalar e executar a ferramenta, o [Node.js](https://nodejs.org/en/) v10 ou superior é necessário. Além disso, também será utilizado o gerenciador de pacotes [npm](https://docs.npmjs.com/) v1.3.2 ou superior.

Primeiro, é necessário instalar as depêndencias da ferramenta. Isso pode ser feito através da seguinte linha de comando:

```
npm i
```

Após a instalação das depêndencias, é necessário configurar a ferramenta. Para isso, você precisa entrar nos arquivos ```config.js```, ```/public/index.html``` e ```/public/issuer.html``` para definir os parâmetros ```porta``` e ```URL_BASE```. Esses parâmetros são importante definir para que a ferramenta possa ser instanciada corretamente e para definir o caminho de rede pelo qual a solução receberá mensagens do dispositivo móvel.

## Como Usar

A ferramenta fará uso de um dispositivo móvel no qual deverá ser instanciado previamente uma identidade autossoberana através do aplicativo [Jolocom SmartWallet](https://github.com/jolocom/smartwallet-app). A instalação pode ser feita em dispositivos [iOS](https://apps.apple.com/us/app/jolocom-smartwallet/id1223869062) ou [Android](https://play.google.com/store/apps/details?id=com.jolocomwallet).

### Inicializando a Aplicação

Para executar a aplicação em modo de desenvolvedor fazendo uso da ferramenta [nodemon](https://www.npmjs.com/package/nodemon), execute a seguinte linha de comando:

```
npm run test
```

Caso queira executar a aplicação normalmente, execute a seguinte linha de comando:

```
npm run start
```

### Acessando a Interface

A aplicação suporta dois tipos de fluxos: 
- Fluxo de emissão e recebimento de credenciais verificáveis da plataforma de testes;
- Fluxo de solicitação, fornecimento e verificação de credenciais verificáveis.


Para acessar a interface de **emissão**, acesse pelo navegador (Requisição HTTP do tipo GET) o seguinte URL: ```URL_BASE/issuer```. 

Para acessar a interface de **autenticação**, acesse pelo navegador (Requisição HTTP do tipo GET) o seguinte URL: ```URL_BASE/login```. 

---
## Autores

* [**Bryan Wolff**](https://github.com/bryan-wolff)

## Mais Informações:
* [**PGID 2021**](https://wiki.rnp.br/display/comitetgi/PGId+2021)