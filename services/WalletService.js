import { Web3Wrapper } from '@0xproject/web3-wrapper';
import { assetDataUtils, BigNumber } from '0x.js';
import EthTx from 'ethereumjs-tx';
import ethUtil from 'ethereumjs-util';
import * as _ from 'lodash';
import { NativeModules } from 'react-native';
import ZeroClientProvider from 'web3-provider-engine/zero';
import Web3 from 'web3';
import EthereumClient from '../clients/ethereum';
import { ZERO, NULL_ADDRESS, MAX } from '../constants/0x';
import { showModal } from '../navigation';

const WalletManager = NativeModules.WalletManager;

let _store;
let _web3;

export function setStore(store) {
  _store = store;
}

export async function supportsFingerPrintUnlock() {
  return await new Promise((resolve, reject) =>
    WalletManager.supportsFingerPrintAuthentication((err, data) => {
      if (err) return reject(err);
      resolve(data);
    })
  );
}

export async function cancelFingerPrintUnlock() {
  return await new Promise((resolve, reject) =>
    WalletManager.cancelFingerPrintAuthentication((err, data) => {
      if (err) return reject(err);
      resolve(data);
    })
  );
}

export async function getPrivateKey(password) {
  return await new Promise((resolve, reject) =>
    WalletManager.loadWallet(password, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    })
  );
}

export async function getWalletAddress() {
  return await new Promise((resolve, reject) =>
    WalletManager.loadWalletAddress((err, data) => {
      if (err) return reject(err);
      if (data) {
        resolve(`0x${ethUtil.stripHexPrefix(data)}`);
      } else {
        resolve();
      }
    })
  );
}

export async function signTransaction(tx, password) {
  return await new Promise((resolve, reject) =>
    WalletManager.signTransaction(tx, password, (err, data) => {
      if (err) return reject(new Error('Could not sign transaction'));
      if (!data) return resolve();
      resolve({
        r: `0x${ethUtil.stripHexPrefix(data.r)}`,
        s: `0x${ethUtil.stripHexPrefix(data.s)}`,
        v: `0x${ethUtil.stripHexPrefix(data.v)}`
      });
    })
  );
}

export async function signMessage(message, password) {
  return await new Promise((resolve, reject) =>
    WalletManager.signMessage(message, password, (err, data) => {
      if (err) return reject(new Error('Could not sign message'));
      resolve(`0x${ethUtil.stripHexPrefix(data)}`);
    })
  );
}

export async function importMnemonics(mnemonics, password) {
  await new Promise((resolve, reject) => {
    WalletManager.importWalletByMnemonics(mnemonics, password, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

export async function generateMnemonics() {
  return await new Promise((resolve, reject) => {
    WalletManager.generateMnemonics((err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

export function getWeb3() {
  if (!_web3) {
    const {
      settings: { ethereumNodeEndpoint },
      wallet: { address }
    } = _store.getState();

    const addresses = [];

    if (address) {
      addresses.push(address.toLowerCase());
    }

    const engine = ZeroClientProvider({
      rpcUrl: ethereumNodeEndpoint,
      getAccounts: cb => {
        cb(null, addresses);
      },
      signTransaction: (txParams, cb) => {
        console.debug(`signTransaction: ${JSON.stringify(txParams, null, 2)}`);
        showModal('modals.UnlockAndSign', {
          tx: txParams,
          next: (err, signature) => {
            if (err) {
              return cb(err);
            }

            if (signature === null || signature === undefined) {
              return cb(new Error('Could not unlock wallet'));
            }

            const signedTx = new EthTx({ ...txParams, ...signature });
            return cb(null, `0x${signedTx.serialize().toString('hex')}`);
          }
        });
      },
      signMessage: (params, cb) => {
        console.debug('signMessage', params);
        showModal('modals.UnlockAndSign', {
          message: params.data,
          next: (err, signature) => {
            if (err) {
              return cb(err);
            }

            if (signature === null || signature === undefined) {
              return cb(new Error('Could not unlock wallet'));
            }

            return cb(
              null,
              `0x${ethUtil.stripHexPrefix(signature.toLowerCase())}`
            );
          }
        });
      }
    });

    _web3 = new Web3(engine);
  }

  return _web3;
}

export function getBalanceByAddress(address) {
  const {
    wallet: { balances },
    relayer: { assets }
  } = _store.getState();
  if (!address) {
    if (!balances[null]) {
      return ZERO;
    } else {
      return Web3Wrapper.toUnitAmount(new BigNumber(balances[null]), 18);
    }
  }

  const asset = _.find(assets, { address });
  if (!asset) return ZERO;
  if (!balances[address]) return ZERO;
  return Web3Wrapper.toUnitAmount(
    new BigNumber(balances[address]),
    asset.decimals
  );
}

export function getBalanceBySymbol(symbol) {
  const {
    wallet: { balances },
    relayer: { assets }
  } = _store.getState();

  if (!symbol) return getBalanceByAddress();

  const asset = _.find(assets, { symbol });
  if (!asset) return ZERO;
  if (!balances[asset.address]) return ZERO;
  return Web3Wrapper.toUnitAmount(
    new BigNumber(balances[asset.address]),
    asset.decimals
  );
}

export function getAdjustedBalanceByAddress(address) {
  const {
    relayer: { assets }
  } = _store.getState();
  if (!address) return getFullEthereumBalance();
  const asset = _.find(assets, { address });
  if (!asset) return ZERO;
  if (asset.symbol === 'ETH' || asset.symbol === 'WETH')
    return getFullEthereumBalance();
  return getBalanceByAddress(address);
}

export function getAdjustedBalanceBySymbol(symbol) {
  if (symbol === 'WETH' || symbol === 'ETH') return getFullEthereumBalance();
  return getBalanceBySymbol(symbol);
}

export function getFullEthereumBalance() {
  return getBalanceBySymbol('ETH').add(getBalanceBySymbol('WETH'));
}

export function getAllowanceByAssetData(assetData) {
  const address = assetDataUtils.decodeERC20AssetData(assetData).tokenAddress;
  return getAllowanceByAddress(address);
}

export function getAllowanceByAddress(address) {
  const {
    wallet: { allowances },
    relayer: { assets }
  } = _store.getState();
  if (!address) {
    return ZERO;
  }

  const asset = _.find(assets, { address });
  if (!asset) return ZERO;
  if (!allowances[address]) return ZERO;
  return Web3Wrapper.toUnitAmount(
    new BigNumber(allowances[address]),
    asset.decimals
  );
}

export function getAllowanceBySymbol(symbol) {
  const {
    wallet: { allowances },
    relayer: { assets }
  } = _store.getState();
  if (!symbol) return ZERO;

  const asset = _.find(assets, { symbol });
  if (!asset) return ZERO;
  if (!allowances[asset.address]) return ZERO;
  return Web3Wrapper.toUnitAmount(
    new BigNumber(allowances[asset.address]),
    asset.decimals
  );
}

export function isUnlockedByAssetData(assetData) {
  const address = assetDataUtils.decodeERC20AssetData(assetData).tokenAddress;
  return isUnlockedByAddress(address);
}

export function isUnlockedByAddress(address) {
  const {
    wallet: { allowances },
    relayer: { assets }
  } = _store.getState();
  if (!address) {
    return false;
  }

  const asset = _.find(assets, { address });
  if (!asset) return false;
  if (!allowances[address]) return false;
  return MAX.eq(allowances[address]);
}

export function isUnlockedBySymbol(symbol) {
  const {
    wallet: { allowances },
    relayer: { assets }
  } = _store.getState();
  if (!symbol) {
    return false;
  }

  const asset = _.find(assets, { symbol });
  if (!asset) return false;
  if (!allowances[asset.address]) return false;
  return MAX.eq(allowances[asset.address]);
}

export function getDecimalsByAddress(address) {
  const {
    relayer: { assets }
  } = _store.getState();
  const asset = _.find(assets, { address });
  if (!asset) return 0;
  return asset.decimals;
}

export function getDecimalsBySymbol(symbol) {
  const {
    relayer: { assets }
  } = _store.getState();
  const asset = _.find(assets, { symbol });
  if (!asset) return 0;
  return asset.decimals;
}

export async function getGasPrice() {
  const web3 = getWeb3();
  return new BigNumber(await web3.eth.getGasPrice());
}

export async function getGasPriceInEth() {
  const gasPrice = await getGasPrice();
  return convertGasPriceToEth(gasPrice);
}

export function convertGasPriceToEth(gasPrice) {
  const web3 = getWeb3();
  return new BigNumber(web3.utils.fromWei(gasPrice.toString()));
}

export async function estimateEthSend() {
  const web3 = getWeb3();
  const ethereumClient = new EthereumClient(web3);
  return await ethereumClient.estimateGas(NULL_ADDRESS, undefined);
}
