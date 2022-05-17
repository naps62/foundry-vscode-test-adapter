"use strict";

import { TestInfo, TestSuiteInfo } from "vscode-test-adapter-api";
import { Log } from "vscode-test-adapter-util";

import { exec } from "child_process";

// const fakeTestSuite: TestSuiteInfo = {
//   type: "suite",
//   id: "root",
//   label: "Fake", // the label of the root node should be the name of the testing framework
//   children: [
//     {
//       type: "suite",
//       id: "nested",
//       label: "Nested suite",
//       children: [
//         {
//           type: "test",
//           id: "test1",
//           label: "Test #1",
//         },
//         {
//           type: "test",
//           id: "test2",
//           label: "Test #2",
//         },
//       ],
//     },
//     {
//       type: "test",
//       id: "test3",
//       label: "Test #3",
//     },
//     {
//       type: "test",
//       id: "test4",
//       label: "Test #4",
//     },
//   ],
// };

export const loadFoundryTests = async (
  workspace: string,
  log: Log
): Promise<TestSuiteInfo> => {
  console.log("here");
  return new Promise((resolve, reject) => {
    exec(
      "/home/naps62/contrib/foundry/target/debug/forge test --list --json | tail -n 1",
      { cwd: workspace },
      (err, stdout, stderr) => {
        if (err) {
          return reject(err);
        }

        const json = JSON.parse(stdout);

        const children: (TestSuiteInfo | TestInfo)[] = Object.keys(json).map(
          (file) => ({
            type: "suite",
            id: file,
            label: file,
            children: Object.keys(json[file]).map((contract) => ({
              type: "suite",
              id: contract,
              label: contract,
              children: json[file][contract].map((test: string) => ({
                type: "test",
                id: test,
                label: test,
              })),
            })),
          })
        );

        const suite: TestSuiteInfo = {
          type: "suite",
          id: "root",
          label: "Foundry",
          children,
        };
        resolve(suite);
      }
    );
  });
};
