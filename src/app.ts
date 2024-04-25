// Loads the local .env file into `process.env`.
require("dotenv").config();

import { Connection, Keypair } from "@solana/web3.js";
import {
  CrossClient,
  Exchange,
  Network,
  Wallet,
  utils,
  types,
  assets,
  Decimal,
  constants,
} from "@zetamarkets/sdk";

const NETWORK_URL = process.env["network_url"]!;


const privateKey = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(Buffer.from(process.env.private_key).toString()))
);

const wallet = new Wallet(privateKey);
console.log(wallet.publicKey)
const connection = new Connection(NETWORK_URL, utils.defaultCommitment());

let buyCount = 0
let sellCount = 0
let orderSize = 0

function delay(ms) {
  return new Promise(resolve => {
      setTimeout(resolve, ms);
  });
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function bot(client) {
  await client.updateState();

  try {

    console.log("Total buy count : ",buyCount)
    console.log("Total sell count : ", sellCount)

    const asset = constants.Asset.JUP;

    if (client.getPositions(asset).length != 0 || orderSize > 0) {
      console.log("waiting for 10 sec before sell ")
      await delay(10000);

      console.log("placing sell order")
      await sell(client)
    }
    else {

      console.log("waiting for 10 sec before buy ")
      await delay(10000);

      console.log("placing buy order")
      await buy(client)
    }
    bot(client)
  } catch (error) {
    bot(client)
  }
}

async function buy(client) {

  const percentageBuy = 0.4
  const asset = constants.Asset.JUP;
  const userBalance = client.getAccountState().balance
  const assetPrice = Exchange.oracle.getPrice(asset).price;
  const orderQuantity = Math.round((userBalance * percentageBuy) / assetPrice)
  const orderPrice = utils.convertDecimalToNativeInteger(assetPrice);
  const orderLots = utils.convertDecimalToNativeLotSize(orderQuantity);

  console.log("order quantity :", orderLots)
  console.log("market price : ", assetPrice)
  

  // { tifOptions: {}, 
  //     orderType: types.OrderType.IMMEDIATEORCANCEL 
  //   }

  try {
    const order = await client.placeOrder(asset,
      orderPrice,
      orderLots,
      types.Side.BID,
    );

    console.log("buy order successfull -------------------------------------------------------------------------------------")
    console.log(order)
    buyCount += 1
    orderSize = orderLots
  } catch (error) {
    console.log(error)
  }
}

async function sell(client) {

  // const asset = constants.Asset.JUP;
  // const myOrderPrices = new Map();
  // myOrderPrices.set(asset, 137);

  // client.closeAllPositions(myOrderPrices)
  //   .then((messages) => {
  //     console.log("sell order successfull -----------------------------------------------------------------------")
  //     console.log(messages.join('\n'));
  //     sellCount += 1
  //   })
  //   .catch((error) => {
  //     console.error('Error closing positions:', error);
  //   });

  const asset = constants.Asset.JUP;
  const assetPrice = Exchange.oracle.getPrice(asset).price;
  const orderPrice = utils.convertDecimalToNativeInteger(assetPrice);

  console.log("order quantity :", orderSize)
  console.log("market price : ", assetPrice)

  try {
    if (orderSize > 0){
      const order = await client.placeOrder(asset,
        orderPrice,
        orderSize,
        types.Side.ASK,
      );
      console.log("sell order successfull -------------------------------------------------------------------------------------")
      console.log(order)
      sellCount += 1
      orderSize = 0
    }
    else{
      console.log("place a buy order using the bot first")
    }
    
    
  } catch (error) {
    console.log(error)
  }

}

async function main() {


  const loadExchangeConfig = types.defaultLoadExchangeConfig(
    Network.MAINNET,
    connection,
    utils.defaultCommitment(),
    0,
    true // LoadFromStore 
  );

  await Exchange.load(
    loadExchangeConfig,
    wallet
  );

  const fee = 1000000;
  Exchange.updatePriorityFee(fee);

  console.log("loaded exchange")

  const client = await CrossClient.load(
    connection,
    wallet, // Use the loaded wallet.
    // utils.defaultCommitment(),
    undefined // Callback - See below for more details.
  );

  console.log("client loaded")

  // const deposted = await client.deposit(5);
  // console.log(deposted)

  console.log("current user balance :", client.getAccountState().balance)

  console.log("starting the zeta farming bot ------------------------------------")
  await bot(client)

}

main().catch(console.error.bind(console));