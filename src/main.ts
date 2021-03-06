import * as vscode from "vscode";
import { TestHub, testExplorerExtensionId } from "vscode-test-adapter-api";
import { Log, TestAdapterRegistrar } from "vscode-test-adapter-util";
import { FoundryAdapter } from "./adapter";

export async function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];

  // create a simple logger that can be configured with the configuration variables
  // `foundryExplorer.logpanel` and `foundryExplorer.logfile`
  const log = new Log(
    "foundryExplorer",
    workspaceFolder,
    "Foundry Explorer Log"
  );
  context.subscriptions.push(log);

  // get the Test Explorer extension
  const testExplorerExtension = vscode.extensions.getExtension<TestHub>(
    testExplorerExtensionId
  );
  if (log.enabled)
    log.info(`Test Explorer ${testExplorerExtension ? "" : "not "}found`);

  if (testExplorerExtension) {
    const testHub = testExplorerExtension.exports;

    // this will register an FoundryTestAdapter for each WorkspaceFolder
    context.subscriptions.push(
      new TestAdapterRegistrar(
        testHub,
        (workspaceFolder) => new FoundryAdapter(workspaceFolder, log),
        log
      )
    );
  }
}
