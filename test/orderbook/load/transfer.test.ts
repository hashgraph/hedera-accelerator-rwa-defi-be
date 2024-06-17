import { ethers } from 'hardhat';
import { expect } from 'chai';
import Utils from '../../utils';
import { AccountId, PrivateKey, Client } from '@hashgraph/sdk';

async function fixture() {
  const client = Client.forTestnet();
      
  const operatorAccountId = AccountId.fromString('');
  const operatorPrivateKey = PrivateKey.fromStringED25519("");

  const operator = {
    accountId: operatorAccountId,
    key: operatorPrivateKey,
    address: '0x' + (operatorAccountId.toSolidityAddress().toLowerCase())
  }

  return {
    client,
    operator,
  }
}

describe('Load Test Exchange HTS', () => {
  describe('Exchange', () => {
    it('should load test', async () => {
      const { client, operator } = await fixture();
      
      await Utils.transferHbar(client, operator, AccountId.fromString('0.0.3640088'), 999);

    });
  });
});

