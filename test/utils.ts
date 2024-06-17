import {
  AccountId,
  Client,
  ContractId,
  PrivateKey,
  TokenId,
  ContractExecuteTransaction,
  AccountAllowanceApproveTransaction,
  TransferTransaction,
  TokenAssociateTransaction,
  FileAppendTransaction,
  ContractFunctionParameters,
  ContractCreateTransaction,
  FileCreateTransaction,
  TokenCreateTransaction,
  AccountCreateTransaction,
  TokenMintTransaction,
  TokenType,
  TokenSupplyType,
  TransactionReceipt,
  TokenUpdateTransaction,
  Hbar,
  Key,
  FileId,
  ContractCallQuery,
  AccountBalanceQuery,
  TransactionRecord,
} from '@hashgraph/sdk';
import axios from 'axios';

export interface Operator {
  accountId: AccountId; 
  key: PrivateKey;
  address: string;
}

class Utils {
  async transferHbar(client: Client, from: Operator, to: string | AccountId, amount: number) {
    client.setOperator(
      from.accountId,
      from.key
    );

    const transferTx = new TransferTransaction()
      .addHbarTransfer(from.accountId, -amount)
      .addHbarTransfer(to, amount)
      .freezeWith(client);

      const transferSign = await transferTx.sign(from.key);
      const tx = await transferSign.execute(client);
      const rx = await tx.getReceipt(client);

      if (rx.status._code != 22) {
        throw new Error('Error transfer token status code' + rx.status._code);
      }

      console.log(`- transferHbar success with id: ${tx.transactionId}`)
  }

  async createAccount(client: Client): Promise<Operator> {
    const key = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY as string);
    const adminAccountTx = await new AccountCreateTransaction()
        .setKey(key.publicKey)
        .setInitialBalance(new Hbar(10))
        .execute(client);
    const adminAccountReceipt = await adminAccountTx.getReceipt(client);

    return { accountId: adminAccountReceipt.accountId as AccountId, key, address: '0x' + adminAccountReceipt.accountId?.toSolidityAddress() } ;
  }

  async createFungibleToken(client: Client, tresury: AccountId, adminKey: PrivateKey, name: string, symbol: string): Promise<TokenId> {
    client.setOperator(
      tresury,
      adminKey
    );

    const tokenCreateTx = await new TokenCreateTransaction()
        .setTokenName(name)
        .setTokenSymbol(symbol)
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
        .setInitialSupply(1000000)
        .setTreasuryAccountId(tresury)
        .setSupplyKey(adminKey)
        .setAdminKey(adminKey)
        .freezeWith(client);

    const tokenCreateTxSign = await tokenCreateTx.sign(adminKey);
    const tokenCreateRx = await tokenCreateTxSign.execute(client);
    const tokenCreateReceipt = await tokenCreateRx.getReceipt(client);
    return tokenCreateReceipt.tokenId as TokenId;
  }

  async updateFungibleTokenSuply(client: Client, tokenId: TokenId, adminKey: PrivateKey,  supplyKey: Key | ContractId): Promise<TokenId> {
    const tokenCreateTx = new TokenUpdateTransaction()
        .setTokenId(tokenId)
        .setSupplyKey(supplyKey)
        .freezeWith(client);

    const tokenCreateTxSign = await tokenCreateTx.sign(adminKey);
    const tokenCreateRx = await tokenCreateTxSign.execute(client);
    const tokenCreateReceipt = await tokenCreateRx.getReceipt(client);
    return tokenCreateReceipt.tokenId as TokenId;
  }

  async deployContract(client: Client, operator: Operator, bytecode: string, params: any[]): Promise<ContractId> {
    // Create a file on Hedera and store the bytecode
    const fileCreateTx = new FileCreateTransaction()
        .setKeys([operator.key.publicKey])
        .setMaxTransactionFee(new Hbar(2)) // Set appropriate max transaction fee
        .freezeWith(client);

    const fileCreateSign = await fileCreateTx.sign(operator.key);
    const fileCreateSubmit = await fileCreateSign.execute(client);
    const fileCreateReceipt = await fileCreateSubmit.getReceipt(client);
    const bytecodeFileId = fileCreateReceipt.fileId as FileId;

    console.log(" - The smart contract bytecode file ID is:", bytecodeFileId.toString());
    
    console.log(" - Upload bytecode in chucks");
    // Append the bytecode in chunks
    const chunkSize = 4096; // 4 KB
    for (let i = 0; i < bytecode.length; i += chunkSize) {
        const chunk = bytecode.slice(i, i + chunkSize);
        const fileAppendTx = new FileAppendTransaction()
            .setFileId(bytecodeFileId)
            .setContents(chunk)
            .setMaxTransactionFee(new Hbar(2)) // Set appropriate max transaction fee
            .freezeWith(client);
        const fileAppendSign = await fileAppendTx.sign(operator.key);
        await fileAppendSign.execute(client);
    }

    console.log(" - Bytecode file upload completed.");

    console.log(params[0], params[1])
    
    // Create the smart contract
    const contractTx = new ContractCreateTransaction()
        .setBytecodeFileId(bytecodeFileId)
        .setConstructorParameters(
          new ContractFunctionParameters()
                  .addAddress(params[0])
                  .addAddress(params[1])
        )
        .setGas(10000000) // Adjust gas as needed
        .setAdminKey(operator.key) // Optional: Set an admin key to manage the contract
        .setMaxTransactionFee(new Hbar(16)); // Set appropriate max transaction fee

    const contractResponse = await contractTx.execute(client);
    const contractReceipt = await contractResponse.getReceipt(client);

    return contractReceipt.contractId as ContractId;
  }

  async tokenMint(client: Client, operator: Operator, tokenId: TokenId | string, amount: number) {
    client.setOperator(
      operator.accountId,
      operator.key
    );

      const tokenMintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(amount)
        .freezeWith(client);
      
      const tokenMintSign = await tokenMintTx.sign(operator.key);
      const tx =  await tokenMintSign.execute(client);
      const rx =  await tx.getReceipt(client);

      if (rx.status._code != 22) {
        throw new Error('Error transfer token mint code' + rx.status._code);
      }

      console.log(`- tokenMint success with id: ${tx.transactionId}`)
  }

  async associateTokenToAccount(client: Client, tokenId: TokenId | string, account: Operator) {
    client.setOperator(
      account.accountId,
      account.key
    );
    // Associate the recipient account with the token
    const associateTx = new TokenAssociateTransaction()
      .setAccountId(account.accountId)
      .setTokenIds([tokenId])
      .freezeWith(client);

    const associateSign = await associateTx.sign(account.key); // Use the recipient's private key
    const result = await associateSign.execute(client);
    const receipt = await result.getReceipt(client);

    if (receipt.status._code != 22) {
      throw new Error('Error Associating token code' + receipt.status._code);
    }

    console.log(`- Associate token transaciton executed ${result.transactionId}`);
  }

  async transferToken(client: Client, tokenId: TokenId | string, from: Operator, to: AccountId, amount: number) {
    client.setOperator(
      from.accountId,
      from.key
    );

    const transferTx = new TransferTransaction()
      .addTokenTransfer(tokenId, from.accountId, amount * -1)
      .addTokenTransfer(tokenId, to, amount * 1)  
      .freezeWith(client);

      const transferSign = await transferTx.sign(from.key);
      const tx = await transferSign.execute(client);
      const rx = await tx.getReceipt(client);

      if (rx.status._code != 22) {
        throw new Error('Error transfer token status code' + rx.status._code);
      }

      console.log(`- transferToken success with id: ${tx.transactionId}`)

  }

  async approveToken(client: Client, tokenId: TokenId | string, from: Operator, spender: AccountId | ContractId | string, amount: number) {
    // Set the operator for the client
    client.setOperator(from.accountId, from.key);

    // Create the AccountAllowanceApproveTransaction
    const approveTx = new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(tokenId, from.accountId, spender, amount)
      .freezeWith(client);

    // Sign the transaction with the owner's key
    const approveSign = await approveTx.sign(from.key);

    // Execute the transaction
    const tx = await approveSign.execute(client);

    // Get the receipt to ensure the transaction was successful
    const receipt = await tx.getReceipt(client);

    // Check the status code
    if (receipt.status._code !== 22) {
      throw new Error('Error approving token status code ' + receipt.status._code);
    }

    // Log the success message
    console.log(`- AccountAllowanceApproveTransaction success with id: ${tx.transactionId}`)
  }

  async executeContract(client: Client, operator: Operator, contract: ContractId | string, functionName: string, params: ContractFunctionParameters, config?: any): Promise<{ receipt: TransactionReceipt, record : TransactionRecord }> {
    const contractExecuteTx = new ContractExecuteTransaction()
        .setContractId(contract)
        .setGas(config?.gas || 1000000) // Adjust based on the complexity of your function
        .setFunction(functionName, params)
        .setMaxTransactionFee(new Hbar(2)) // Set an appropriate max transaction fee
        .freezeWith(client)

    // Sign and execute the transaction
    const contractExecuteSign = await contractExecuteTx.sign(operator.key);
    const contractExecuteSubmit = await contractExecuteSign.execute(client);

    console.log(` - Contract Execute ${functionName} with transaction ${contractExecuteSubmit.transactionId.toString()}`);

    return { 
      receipt: await contractExecuteSubmit.getReceipt(client),
      record : await contractExecuteSubmit.getRecord(client),
    }

  }

  async queryContract(client: Client, contractId: ContractId, functionName: string, params: ContractFunctionParameters) {
    const query = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000) // Adjust gas limit as needed
        .setFunction(functionName, params);

    return await query.execute(client);
  }

  async queryAccountBalance(client: Client, accountId: AccountId) {
    const balanceQuery = new AccountBalanceQuery()
        .setAccountId(accountId);

    const accountBalance = await balanceQuery.execute(client);
    return accountBalance;
  }

  async queryTokenBalance(client: Client, accountId: AccountId, tokenId: TokenId) {
      const accountBalance = await this.queryAccountBalance(client, accountId);
      const tokenBalance = accountBalance?.tokens?.get(tokenId);
      return tokenBalance;
  }

  async queryAccountInfo(ownerAccountId: AccountId | ContractId) {
    const mirrorNodeUrl = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com"; // Use appropriate mirror node URL

    try {
        const response = await axios.get(`${mirrorNodeUrl}/api/v1/accounts/${ownerAccountId.toString()}`);
        return response.data;       
    } catch (error) {
        console.error(`Error querying allowance: ${error}`);
    }
  }

  async queryTokenInfo(tokenId: TokenId | string) {
    const mirrorNodeUrl = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com"; // Use appropriate mirror node URL

    try {
        const response = await axios.get(`${mirrorNodeUrl}/api/v1/tokens/${tokenId.toString()}`);
        return response.data;       
    } catch (error) {
        console.error(`Error querying allowance: ${error}`);
    }
  }
}

export default new Utils();
