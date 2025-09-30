import * as readline from "readline";

export async function promptAddress(title: string, defaultValue?: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise<string>((resolve) => {
        const prompt = `Enter ${title} ${defaultValue ? `(press enter to use default ${defaultValue})` : ""}: `;

        rl.question(prompt, (answer) => {
            rl.close();
            const result = answer.trim() || defaultValue;

            if (!result) {
                throw new Error(`${title} is required`);
            }

            resolve(result);
        });
    });
}
