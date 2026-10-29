import {ParticleNetwork, WalletEntryPosition} from "@particle-network/auth";
import {ParticleProvider} from "@particle-network/provider";
import {opBNB} from "@particle-network/chains";
import Web3 from "web3";

export const particle = new ParticleNetwork({
  projectId: "e7a2e93c-c188-44c0-baeb-8f6143c5c2d3",
  clientKey: "c4LWIk9L7zcfqoXUvwGrDsaVjG5ZdH7Bvgr5j4vz",
  appId: "479dd2f7-d62e-4a20-a2a5-56482e54588b",
  chainName: opBNB.name, //optional: current chain name, default Ethereum.
  chainId: opBNB.id, //optional: current chain id, default 1.
  wallet: {   //optional: by default, the wallet entry is displayed in the bottom right corner of the webpage.
    displayWalletEntry: true,  //show wallet entry when connect particle.
    defaultWalletEntryPosition: WalletEntryPosition.BR, //wallet entry position
    uiMode: "dark",  //optional: light or dark, if not set, the default is the same as web auth.
    // supportChains: [{ id: 1, name: "Ethereum"}, { id: 5, name: "Ethereum"}], // optional: web wallet support chains.
    customStyle: {}, //optional: custom wallet style
  },
  securityAccount: { //optional: particle security account config
    //prompt set payment password. 0: None, 1: Once(default), 2: Always
    promptSettingWhenSign: 1,
    //prompt set master password. 0: None(default), 1: Once, 2: Always
    promptMasterPasswordSettingWhenLogin: 1
  },
});

export const particleProvider = new ParticleProvider(particle.auth);
//if you need support solana chain
// const solanaWallet = new SolanaWallet(particle.auth);

//if you use web3.js
// window.web3 = new Web3(particleProvider);
// window.web3.currentProvider.isParticleNetwork // => true

// //if you use ethers.js
// import { ethers } from "ethers";
// const ethersProvider = new ethers.providers.Web3Provider(particleProvider, "any");
// const ethersSigner = ethersProvider.getSigner();
