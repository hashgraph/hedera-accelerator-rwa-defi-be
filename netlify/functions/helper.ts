import { AccountId, Client, ContractId, PrivateKey } from "@hashgraph/sdk";
import { config } from "dotenv";
config();

export function getClient() {
  const accountId = process.env.ACCOUNT_ID;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!accountId || !privateKey || !contractAddress) {
    throw new Error('Missing required environment variables');
  }

  const operatorKey = PrivateKey.fromStringECDSA(privateKey);
  const operatorId = AccountId.fromString(accountId);
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  return {
    client,
    contractId,
    operatorId,
    operatorKey
  }
}
