"use strict";

import { exec } from "child_process";
import { EventEmitter } from "vscode";
import {
  TestSuiteInfo,
  TestInfo,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestSuiteEvent,
  TestEvent,
} from "vscode-test-adapter-api";

function forgeExec(args: string, cwd: string): Promise<any> {
  return new Promise((resolve, reject) => {
    exec(
      `~/.foundry/bin/forge ${args} --json | sed -n -e '/^{/p'`,
      { cwd },
      (err, stdout) => {
        if (err) {
          reject(err);
        }
        resolve(JSON.parse(stdout));
      }
    );
  });
}

export const loadTests = async (workspace: string): Promise<TestSuiteInfo> => {
  const json = await forgeExec("test --list", workspace);

  const children: (TestSuiteInfo | TestInfo)[] = Object.keys(json).map(
    (path) => ({
      type: "suite",
      id: `path:${path}`,
      label: path,
      file: `${workspace}/${path}`,
      children: Object.keys(json[path]).map((contract) => ({
        type: "suite",
        id: `contract:${path}:${contract}`,
        label: contract,
        file: `${workspace}/${path}`,
        children: json[path][contract].map((test: string) => ({
          type: "test",
          id: `test:${path}:${contract}:${test}`,
          label: test,
          file: `${workspace}/${path}`,
        })),
      })),
    })
  );

  return {
    type: "suite",
    id: "root",
    label: "Foundry",
    children,
  };
};

const emitTestResults = async (
  json: any,
  emitter: EventEmitter<
    TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
  >
): Promise<void> => {
  const emissions = Object.keys(json).map(async (contractKey) => {
    const contract = json[contractKey];

    return Object.keys(contract.test_results).map(async (fnKey) => {
      const result = contract.test_results[fnKey];
      const fn = fnKey.replace(/\(.*$/, "");
      const id = `test:${contractKey}:${fn}`;
      const state = result.success ? "passed" : "failed";

      emitter.fire(<TestEvent>{ type: "test", test: id, state });
    });
  });

  await Promise.all(emissions.flat());
};

export const runSingleCase = async (
  id: string,
  workspace: string,
  emitter: EventEmitter<
    TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
  >
): Promise<void> => {
  const [type, ...rest] = id.split(":");
  let filter;

  switch (type) {
    case "root":
      filter = "";
      break;
    case "path":
      filter = `--match-path ${rest[0]}`;
      break;
    case "contract":
      filter = `--match-path ${rest[0]} --match-contract ${rest[1]}`;
      break;
    case "test":
      filter = `--match-path ${rest[0]} --match-contract ${rest[1]} --match-test ${rest[2]}`;
      break;
  }

  const json = await forgeExec(`test ${filter}`, workspace);

  await emitTestResults(json, emitter);
};

export const runTests = async (
  ids: string[],
  workspace: string,
  emitter: EventEmitter<
    TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent
  >
): Promise<void> => {
  await Promise.all(
    ids.map(async (id) => {
      const isSuite = id === "suite";

      if (isSuite) {
        emitter.fire(<TestSuiteEvent>{
          type: "suite",
          suite: id,
          state: "running",
        });
      } else {
        emitter.fire(<TestEvent>{
          type: "test",
          test: id,
          state: "running",
        });
      }

      await runSingleCase(id, workspace, emitter);

      if (isSuite) {
        emitter.fire(<TestSuiteEvent>{
          type: "suite",
          suite: id,
          state: "completed",
        });
      }
    })
  );
};
