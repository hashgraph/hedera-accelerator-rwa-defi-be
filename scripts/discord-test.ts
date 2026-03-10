import { ContractExecuteTransaction, ContractFunctionParameters, Long, TransactionId } from "@hashgraph/sdk";

// Your MarketParams object from the previous example
export const MarketParams = {
  loanToken: "0x0000000000000000000000000000000000631766",
  collateralToken: "0x00000000000000000000000000000000006353C7",
  oracle: "0x10535a028c31C3d169B74E0B4bb141e064cAc2B5",
  irm: "0xC2f4fc5416d96ac447388EAD98c8eeDb45d6Ba82",
  lltv: "860000000000000000",
};

// --- Hardcoded Placeholder Values ---
const transactionId = TransactionId.fromString("0.0.12345@1723054800.123456789");
const contractId = "0.0.543210"; // <-- REPLACE WITH YOUR REAL CONTRACT ID
const amountToDeposit = Long.fromString("100000000");
const shares = Long.fromString("100000000");
const onBehalfAddress = "0x1234567890123456789012345678901234567890";
const callData = new Uint8Array();

// --- Building the Transaction ---
const depositTx = new ContractExecuteTransaction()
    // Using the hardcoded placeholders
    .setTransactionId(transactionId)
    .setContractId(contractId) 
    .setGas(100_000_000)
    .setFunction(
      "supply",
      new ContractFunctionParameters()
        // The 5 "flattened" struct fields
        .addAddress(MarketParams.loanToken)
        .addAddress(MarketParams.collateralToken)
        .addAddress(MarketParams.oracle)
        .addAddress(MarketParams.irm)
        .addUint256(Long.fromString(MarketParams.lltv))
        // The rest of the original arguments
        .addUint256(amountToDeposit)
        .addUint256(shares)
        .addAddress(onBehalfAddress)
        .addBytes(callData)
    );

console.log("Transaction built successfully:", depositTx);