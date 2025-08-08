import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  AccountId,
  ContractId,
} from "@hashgraph/sdk";
import { Handler } from "@netlify/functions";
import { Interface } from "ethers";

const iface = new Interface([
  "function registerTask(address target, bytes4 selector)",
]);

export const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const accountId = process.env.ACCOUNT_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS; // UpKeeper EVM address

    if (!accountId || !privateKey || !contractAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing environment variables",
          message:
            "ACCOUNT_ID, PRIVATE_KEY, and CONTRACT_ADDRESS must be set",
        }),
      };
    }

    const { target, selector } = JSON.parse(event.body || "{}") as {
      target?: string;
      selector?: string;
    };

    if (!target || !/^0x[a-fA-F0-9]{40}$/.test(target)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid target address" }),
      };
    }

    const normSelector = selector?.startsWith("0x") ? selector : `0x${selector || ""}`;
    if (!normSelector || !/^0x[a-fA-F0-9]{8}$/.test(normSelector)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid selector (expected 0x + 8 hex)" }),
      };
    }

    const operatorKey = PrivateKey.fromStringECDSA(privateKey);
    const operatorId = AccountId.fromString(accountId);
    const client = Client.forPreviewnet().setOperator(operatorId, operatorKey);

    const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);

    const data = iface.encodeFunctionData("registerTask", [target, normSelector]);

    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .freezeWith(client)
      .sign(operatorKey);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: receipt.status.toString(),
        transactionHash: Buffer.from(response.transactionHash).toString("hex"),
      }),
    };
  } catch (error) {
    console.error("Error in upkeeper-register-task:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};


