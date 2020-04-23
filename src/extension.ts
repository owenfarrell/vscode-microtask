"use strict";

import * as fs from "fs";
import * as Path from "path";
import * as vscode from "vscode";

const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("Sub Launcher");
let taskItems: TaskQuickPickItem[] = [];
let cwdMap: { [key: string]: string; } = {};

export function activate(context: vscode.ExtensionContext) {
    // If a workspace has been opened
    if (vscode.workspace.rootPath) {
        // When the configuration changes, reload the task list
        vscode.workspace.onDidChangeConfiguration(loadTaskList);
        // Load the task list for the first time
        loadTaskList();
        // Subscribe to "microtask.runFromHere" events
        context.subscriptions.push(vscode.commands.registerCommand("microtask.runFromHere", runFromHere));
        // Subscribe to "task process end" events
        vscode.tasks.onDidEndTaskProcess(resetTaskCwd);
    }
}

export function deactivate() {
    outputChannel.dispose();
}

interface TaskQuickPickItem extends vscode.QuickPickItem {
    task: vscode.Task;
}

function loadTaskList() {
    // Fetch the list of tasks
    vscode.tasks.fetchTasks()
        // Wrap each task in a QuickPickItem
        .then((taskList: vscode.Task[]) => {
            let refreshedList = taskList.map((element: vscode.Task) => <TaskQuickPickItem>{ description: "", label: element.name, task: element });
            let refreshedMap = {};
            taskItems.forEach((element: TaskQuickPickItem) => refreshedMap[element.task.name] = element.task.execution.options.cwd)
            // Replace the cached list of QuickPickItems
            taskItems = refreshedList;
            cwdMap = refreshedMap;
        });
}

function runFromHere(uri: vscode.Uri) {
    // Show the quick pick menu
    vscode.window.showQuickPick<TaskQuickPickItem>(taskItems)
        // Spawn a process based on the selected task
        .then((selectedItem: TaskQuickPickItem) => {
            if (selectedItem) {
                // Override the CWD for the task
                selectedItem.task.execution.options.cwd = uri ? fs.lstatSync(uri.fsPath).isDirectory() ? uri.fsPath : Path.dirname(uri.fsPath) : vscode.workspace.rootPath;
                // Execute the task
                vscode.tasks.executeTask(selectedItem.task);
            }
        });
}

function resetTaskCwd(event: vscode.TaskProcessEndEvent) {
    // Replace the CWD with the original value
    event.execution.task.execution.options.cwd = cwdMap[event.execution.task.name];
}
