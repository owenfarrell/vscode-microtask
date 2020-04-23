"use strict";

import * as fs from "fs";
import * as Path from "path";
import * as vscode from "vscode";

const outputChannel = vscode.window.createOutputChannel("Sub Launcher");
let taskItems: TaskQuickPickItem[] = [];
let cwdMap = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    // If a workspace has been opened
    if (vscode.workspace.rootPath) {
        // Load the task list for the first time
        loadTaskList();

        context.subscriptions.push(
            // Subscribe to "change configuration" events
            vscode.workspace.onDidChangeConfiguration(loadTaskList),
            // Register the command
            vscode.commands.registerCommand("microtask.runFromHere", runFromHere),
            // Subscribe to "task process end" events
            vscode.tasks.onDidEndTaskProcess(resetTaskCwd),
            outputChannel
        );
    }
}

export function deactivate() {
}

interface TaskQuickPickItem extends vscode.QuickPickItem {
    task: vscode.Task;
}

function loadTaskList() {
    // Fetch the list of tasks
    vscode.tasks.fetchTasks()
        .then((taskList) => {
            // Create an array of QuickPickItems
            let refreshedList: TaskQuickPickItem[] = [];
            // Create a Map of
            let refreshedMap = new Map<string, string>();
            // For each task
            taskList.forEach((element) => {
                // Wrap the task in a QuickPickItem and push it on to the array
                refreshedList.push({ description: "", label: element.name, task: element });
                // Cache the default CWD in the map
                refreshedMap[element.name] = element.execution.options.cwd
            });
            // Replace the cached list of QuickPickItems
            taskItems = refreshedList;
            // Replace the cached map of Task CWDs
            cwdMap = refreshedMap;
        });
}

function runFromHere(uri: vscode.Uri) {
    // Show the quick pick menu
    vscode.window.showQuickPick<TaskQuickPickItem>(taskItems)
        // Spawn a process based on the selected task
        .then((selectedItem) => {
            if (selectedItem) {
                // Override the CWD for the task
                selectedItem.task.execution.options.cwd = uri ? fs.lstatSync(uri.fsPath).isDirectory() ? uri.fsPath : Path.dirname(uri.fsPath) : vscode.workspace.rootPath;
                // Execute the task
                vscode.tasks.executeTask(selectedItem.task);
            }
        });
}

function resetTaskCwd(event: vscode.TaskProcessEndEvent) {
    // TODO Possible race condition where configuration is reloaded after task execution started
    // Replace the CWD with the original value
    event.execution.task.execution.options.cwd = cwdMap.get(event.execution.task.name);
}
