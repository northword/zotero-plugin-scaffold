// npx 创建模板
import { confirm, input, select } from "@inquirer/prompts";

export default class Create {
  async run() {
    const answers = await this.prompting();
    console.log(answers);
  }

  async prompting() {
    const answers = {
      plugin: {
        name: await input({ message: "What's the name of plugin?" }),
        description: await input({
          message: "What's description of plugin?",
        }),
        id: await input({ message: "What's the ID of plugin?" }),
      },
      code: {
        namespace: await input({
          message: "What's the namespace of plugin?",
          default: "",
        }),
        // package manager select: npm yarn pnpm
        // use typescript?
        // use prettier and lint?
      },
      user: {
        name: await input({ message: "What's your GitHub user ID?" }),
        email: await input({ message: "What's your email?" }),
      },
      // install deps?
    };

    return answers;
  }

  downloadTemplate() {
    //
  }

  parseTemplate() {
    //
  }
}
