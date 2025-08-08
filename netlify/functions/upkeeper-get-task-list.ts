import { ContractCallQuery } from "@hashgraph/sdk";
import { Handler } from "@netlify/functions";
import { AbiCoder } from "ethers";
import { getClient } from "./helper";

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

  try {
    const accountId = process.env.ACCOUNT_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS; // EVM address "0x..."

    if (!accountId || !privateKey || !contractAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing environment variables",
          message: "ACCOUNT_ID, PRIVATE_KEY, and CONTRACT_ADDRESS must be set",
        }),
      };
    }

    const page = Math.max(1, Number(event.queryStringParameters?.page || "1"));
    const pageSize = Math.max(
      1,
      Number(event.queryStringParameters?.pageSize || "10")
    );

    const { client, contractId } = getClient();

    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(300_000)
      .setFunction("getTaskList");

    const res = await query.execute(client);
    const raw = res.asBytes();
    const [taskIds] = AbiCoder.defaultAbiCoder().decode(["bytes32[]"], raw);

    const total = taskIds.length;
    const start = (page - 1) * pageSize;
    const end = Math.min(total, start + pageSize);
    const pageItems = taskIds.slice(start, end);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total,
        page,
        pageSize,
        taskIds: pageItems,
      }),
    };
  } catch (error) {
    console.error("Error in upkeeper-get-task-list:", error);
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


