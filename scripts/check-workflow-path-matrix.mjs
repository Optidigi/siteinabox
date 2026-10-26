import { readFileSync, readdirSync } from "node:fs"
const matrix = JSON.parse(readFileSync("docs/workflow-path-matrix.json", "utf8"))
const source = readFileSync(".github/workflows/ci.yml", "utf8")
if (matrix.schemaVersion !== 2 || JSON.stringify(Object.keys(matrix.workflows)) !== JSON.stringify(["ci.yml"]) ||
    JSON.stringify(matrix.workflows["ci.yml"].applications) !== JSON.stringify(["cms", "renderer", "site"]) ||
    matrix.workflows["ci.yml"].unconditionalImages !== true ||
    readdirSync(".github/workflows").some(file => /^build-.*-image\.ya?ml$/.test(file)) ||
    /paths(?:-ignore)?:|branches-ignore:|pull_request_target:/.test(source.split("jobs:")[0]) ||
    !source.includes("  pull_request:\n") || !source.includes("    branches: [main]") ||
    !source.includes("app: [cms, renderer, site]")) throw new Error("Every PR/main source must reach all images through one canonical workflow")
console.log("Workflow ownership verified: one canonical producer, all application/source paths covered")
