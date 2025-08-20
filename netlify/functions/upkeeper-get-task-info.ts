import {
  ContractCallQuery,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
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
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const accountId = process.env.ACCOUNT_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

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

    const { taskIds } = JSON.parse(event.body || "{}") as { taskIds?: string[] };
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "taskIds array required" }),
      };
    }

    const { client, contractId } = getClient();

    const coder = AbiCoder.defaultAbiCoder();

    const results = [] as Array<{
      taskId: string;
      executions: string;
      target: string;
      selector: string;
      exists: boolean;
      executing: boolean;
    }>;
    for (const id of taskIds) {
      const hex = id.startsWith("0x") ? id.slice(2) : id;
      const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
      if (bytes.length !== 32) {
        throw new Error(`Invalid taskId length. Expected 32 bytes, got ${bytes.length}`);
      }
      const params = new ContractFunctionParameters().addBytes32(bytes);
      const query = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(300_000)
        .setFunction("getTaskInfo", params);

      const res = await query.execute(client);
      const raw = res.asBytes();
      const [task] = coder.decode(["(uint256,address,bytes4,bool,bool)"], raw);

      results.push({
        taskId: id,
        executions: task[0].toString(),
        target: task[1],
        selector: task[2],
        exists: task[3],
        executing: task[4],
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, tasks: results }),
    };
  } catch (error) {
    console.error("Error in upkeeper-get-task-info:", error);
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


