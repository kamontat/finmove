import { render } from "ink";
import React from "react";
import { parseArgs } from "./core/parseArgs";
import { App } from "./tui/App";

const args = parseArgs(process.argv.slice(2));
console.clear();
render(React.createElement(App, { args }));
