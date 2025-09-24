import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface ScriptInfo {
    name: string;
    path: string;
    category: string;
    description?: string;
}

class ScriptRunner {
    private scripts: ScriptInfo[] = [];
    private rl: readline.Interface;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    private async question(prompt: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    private scanScripts(dir: string, category: string = ""): void {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Recursively scan subdirectories
                const newCategory = category ? `${category}/${item}` : item;
                this.scanScripts(fullPath, newCategory);
            } else if (item.endsWith(".ts") && item !== "run.ts") {
                // Add TypeScript files (excluding this runner script)
                const scriptName = item.replace(".ts", "");
                const relativePath = path.relative(process.cwd(), fullPath);

                this.scripts.push({
                    name: scriptName,
                    path: relativePath,
                    category: category || "root",
                    description: this.getScriptDescription(fullPath) || undefined,
                });
            }
        }
    }

    private getScriptDescription(filePath: string): string | null {
        try {
            const content = fs.readFileSync(filePath, "utf8");

            // Look for common description patterns
            const patterns = [
                /\/\/\s*Description:\s*(.+)/i, // Description comment
            ];

            for (const pattern of patterns) {
                const match = content.match(pattern);
                if (match && match[1]) {
                    return match[1].trim().substring(0, 80);
                }
            }
        } catch (error) {
            // Ignore errors reading file
        }

        return null;
    }

    private displayScripts(): void {
        console.log("\n📋 Available Scripts");
        console.log("===================");

        // Group scripts by category
        const categories = new Map<string, ScriptInfo[]>();
        for (const script of this.scripts) {
            if (!categories.has(script.category)) {
                categories.set(script.category, []);
            }
            categories.get(script.category)!.push(script);
        }

        let index = 1;
        const scriptMap = new Map<number, ScriptInfo>();

        // Display scripts grouped by category
        for (const [category, scripts] of categories) {
            console.log(`\n📁 ${category.toUpperCase()}`);
            console.log("─".repeat(category.length + 3));

            for (const script of scripts) {
                console.log(
                    `${index.toString().padStart(2)}. ${script.name}` +
                        (script.description ? ` - ${script.description}` : ""),
                );
                scriptMap.set(index, script);
                index++;
            }
        }

        console.log(`\n${index}. 🔍 Search scripts`);
        console.log(`${index + 1}. 📊 Show script details`);
        console.log(`${index + 2}. 🚪 Exit`);
    }

    private async searchScripts(): Promise<ScriptInfo[]> {
        const query = await this.question("\n🔍 Enter search term: ");
        const results = this.scripts.filter(
            (script) =>
                script.name.toLowerCase().includes(query.toLowerCase()) ||
                script.description?.toLowerCase().includes(query.toLowerCase()) ||
                script.category.toLowerCase().includes(query.toLowerCase()),
        );

        if (results.length === 0) {
            console.log("❌ No scripts found matching your search.");
            return [];
        }

        console.log(`\n🔍 Search Results (${results.length} found):`);
        console.log("=".repeat(40));

        results.forEach((script, i) => {
            console.log(`${i + 1}. ${script.name} (${script.category})`);
            console.log(`   ${script.description}`);
        });

        return results;
    }

    private async showScriptDetails(): Promise<void> {
        const scriptName = await this.question("\n📊 Enter script name: ");
        const script = this.scripts.find((s) => s.name === scriptName);

        if (!script) {
            console.log("❌ Script not found.");
            return;
        }

        console.log(`\n📄 Script Details: ${script.name}`);
        console.log("=".repeat(50));
        console.log(`Category: ${script.category}`);
        console.log(`Path: ${script.path}`);
        console.log(`Description: ${script.description}`);

        try {
            const content = fs.readFileSync(script.path, "utf8");
            const lines = content.split("\n");
            console.log(`Lines of code: ${lines.length}`);

            // Show first few lines
            console.log("\nFirst 10 lines:");
            console.log("-".repeat(20));
            lines.slice(0, 10).forEach((line, i) => {
                console.log(`${(i + 1).toString().padStart(2)}: ${line}`);
            });

            if (lines.length > 10) {
                console.log("...");
            }
        } catch (error) {
            console.log("❌ Could not read script file.");
        }
    }

    private async runScript(script: ScriptInfo): Promise<void> {
        console.log(`\n🚀 Running: ${script.name}`);
        console.log("=".repeat(50));

        try {
            // Check if we're in the right directory
            const packageJsonPath = path.join(process.cwd(), "package.json");
            if (!fs.existsSync(packageJsonPath)) {
                console.log("❌ Please run this script from the project root directory.");
                return;
            }

            // Run the script using hardhat
            const command = `yarn hardhat run ${script.path} --network testnet`;
            console.log(`Command: ${command}`);
            console.log("\n" + "─".repeat(50));

            execSync(command, {
                stdio: "inherit",
                cwd: process.cwd(),
            });

            console.log("\n" + "─".repeat(50));
            console.log("✅ Script completed successfully!");
        } catch (error) {
            console.log("\n❌ Script failed:");
            if (error instanceof Error) {
                console.log(error.message);
            }
        }
    }

    private async selectScript(): Promise<ScriptInfo | null> {
        const input = await this.question("\n🎯 Select a script (number): ");
        const choice = parseInt(input);

        if (isNaN(choice)) {
            console.log("❌ Please enter a valid number.");
            return null;
        }

        const totalScripts = this.scripts.length;

        if (choice === totalScripts + 1) {
            // Search scripts
            const results = await this.searchScripts();
            if (results.length === 0) return null;

            const searchChoice = await this.question("Select from search results (number): ");
            const searchIndex = parseInt(searchChoice);

            if (isNaN(searchIndex) || searchIndex < 1 || searchIndex > results.length) {
                console.log("❌ Invalid selection.");
                return null;
            }

            return results[searchIndex - 1];
        }

        if (choice === totalScripts + 2) {
            // Show script details
            await this.showScriptDetails();
            return null;
        }

        if (choice === totalScripts + 3) {
            // Exit
            return null;
        }

        if (choice < 1 || choice > totalScripts) {
            console.log("❌ Invalid selection.");
            return null;
        }

        return this.scripts[choice - 1];
    }

    public async run(): Promise<void> {
        console.log("🎮 Interactive Script Runner");
        console.log("============================");
        console.log("Scanning for scripts...");

        // Scan for scripts
        this.scanScripts(__dirname);

        if (this.scripts.length === 0) {
            console.log("❌ No scripts found.");
            return;
        }

        console.log(`✅ Found ${this.scripts.length} scripts`);

        while (true) {
            this.displayScripts();

            const selectedScript = await this.selectScript();

            if (!selectedScript) {
                break;
            }

            await this.runScript(selectedScript);

            const continueChoice = await this.question("\n🔄 Run another script? (y/n): ");
            if (continueChoice.toLowerCase() !== "y" && continueChoice.toLowerCase() !== "yes") {
                break;
            }
        }

        console.log("\n👋 Goodbye!");
        this.rl.close();
    }
}

// Main execution
async function main() {
    const runner = new ScriptRunner();
    await runner.run();
}

main().catch((error) => {
    console.error("❌ Runner failed:", error);
    process.exit(1);
});
