export async function promptAddress(title: string): Promise<string> {
    // Prompt user for building address
    const userInput = await new Promise<string>((resolve) => {
        process.stdout.write(`Enter address ${title} `);
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
    });

    if (!userInput) {
        throw new Error(`${title} is required`);
    }

    return userInput;
}
