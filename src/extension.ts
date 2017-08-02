'use strict';

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as Path from 'path';
import * as vscode from 'vscode';

const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel('Sub Launcher');
var taskItems: TaskQuickPickItem[] = [];
var taskMap: { [key: string]: string; } = {};

export function activate(context: vscode.ExtensionContext) {
    // If a workspace has been opened
    if (vscode.workspace.rootPath) {
        // When the configuration changes, reload the task list
        vscode.workspace.onDidChangeConfiguration(loadTaskList);
        // Load the task list for the first time
        loadTaskList();
        // Subscribe to 'torpedo.runFromHere' events
        context.subscriptions.push(vscode.commands.registerCommand('microtask.runFromHere', runFromHere));
    }
}

export function deactivate() {
    outputChannel.dispose();
}

interface TaskQuickPickItem extends vscode.QuickPickItem {
    // TODO Strongly type this field to an interface provided by the vscode namespace
    task: any;
}

function loadTaskList() {
    let refreshedItems: TaskQuickPickItem[] = [];
    // Get the task configuration for the workspace
    let tasksConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('tasks');
    // If there are multiple tasks defined
    if (tasksConfiguration.tasks) {
        // Get the subtasks
        let taskArray: any[] = tasksConfiguration.get('tasks');
        // If multiple tasks are defined
        if (taskArray.length > 0) {
            // For each task
            taskArray.forEach((element: any) => {
                // Add a quick pick item to the array
                refreshedItems.push({
                    description: '',
                    label: element.taskName,
                    task: element
                });
            });
        }
    }
    taskItems = refreshedItems;
}

function runFromHere(uri: vscode.Uri) {
    // Show the quick pick menu
    vscode.window.showQuickPick<TaskQuickPickItem>(taskItems)
        // Spawn a process based on the selected task
        .then((selectedItem: TaskQuickPickItem) => {
            if (selectedItem) {
                let processArguments = selectedItem.task.args || [];
                let spawnOptions: cp.SpawnOptions = {
                    // Get the folder of the specified uri (or workspace root if not sepecified)
                    cwd: uri ? fs.lstatSync(uri.fsPath).isDirectory() ? uri.fsPath : Path.dirname(uri.fsPath) : vscode.workspace.rootPath,
                    env: selectedItem.task.env,
                    // FIXME Update this conditional to support optional values
                    shell: selectedItem.task.type === 'shell'
                };
                // Get the presentation configuration of the task (or create a default version if none exists)
                let presentationConfig = selectedItem.task.presentation || {
                    echo: true,
                    panel: 'shared',
                    reveal: 'always'
                };

                // If the output should be sent to a new presentation panel, create a new panel
                // FIXME Create a new output channel on demand
                if (presentationConfig.panel === 'new') outputChannel.clear();
                // If the output should be sent to a dedicated presentation panel, use the existing panel
                if (presentationConfig.panel === 'dedicated') outputChannel.clear();

                // If the command should be printed as part of the presentation, echo the command and arguments
                if (presentationConfig.echo === true) outputChannel.appendLine(`> Executing task: ${selectedItem.task.command} ${processArguments.join(' ')} <${os.EOL}`);

                // If the presentation should always be revealed, show the panel
                if (presentationConfig.reveal === 'always') outputChannel.show();

                // Spawn a child process
                let childProcess: cp.ChildProcess = cp.spawn(selectedItem.task.command, processArguments, spawnOptions);
                // When data is written STDOUT of the child process, write the stringified data to the output channel
                childProcess.stdout.on('data', (stdoutData: any) => outputChannel.append(stdoutData.toString()));
                // If the presentation should be revealed on error, show the panel
                if (presentationConfig.reveal === 'silent') childProcess.stdout.on('error', () => outputChannel.show());
            }
        });
}
