const assert = require('node:assert/strict');
const {
  test, describe, beforeEach, afterEach,
} = require('node:test');

const { getToolDefinitions } = require('../src/mcpToolDefinitions');

// Every integration env var that gates a group of tools in mcpToolDefinitions.js.
const INTEGRATION_ENV_VARS = [
  'GITHUB_TOKEN',
  'AZURE_DEVOPS_PAT',
  'DOSA_API_KEY',
  'DOSA_API_SECRET',
  'DOSA_AUTH_TENANT_ID',
  'DOSA_CLIENT_ID',
  'MAPS_API_KEY',
  'KUBERNETES_API_ENDPOINT',
  'KUBERNETES_BEARER_TOKEN',
  'DATABASE_URI',
];

const SYSTEM_INFO_TOOL_NAMES = [
  'scan_network_for_ssh',
  'collect_basic_system_info',
  'collect_detailed_system_info',
  'test_ssh_connect',
  'collect_system_process_info',
  'collect_system_service_info',
];

// The full set of tool names expected when every integration is enabled.
// This is the migration's acceptance contract against the original
// functions.js registry - if a tool is accidentally renamed, dropped, or
// duplicated, this list will no longer match.
const ALL_TOOL_NAMES = [
  'ado_file_review', 'check_ado_branch_exists', 'check_ado_repo_exists', 'check_branch_exists',
  'check_repo_exists', 'collect_basic_system_info', 'collect_detailed_system_info',
  'collect_system_process_info', 'collect_system_service_info', 'commit_ado_files', 'commit_files',
  'connect_database', 'create_ado_branch', 'create_ado_pipeline', 'create_ado_pull_request',
  'create_ado_repo', 'create_branch', 'create_github_workflow_dispatch', 'create_kubernetes_resource',
  'create_pull_request', 'create_repo', 'delete_ado_pipeline', 'delete_content',
  'delete_github_workflow_run', 'delete_kubernetes_resource', 'dump_database_structure',
  'fetch_ado_repo_contents', 'fetch_repo_contents', 'generate_Maps_link', 'get_ado_file_contents',
  'get_ado_pipeline_run_logs', 'get_docker_tags', 'get_github_file_contents',
  'get_github_workflow_run_logs', 'get_kubernetes_deployment_details', 'get_kubernetes_node_details',
  'get_kubernetes_pod_details', 'get_kubernetes_pod_logs', 'get_kubernetes_secret_details',
  'get_kubernetes_service_details', 'get_kubernetes_version', 'get_mot_history', 'github_file_review',
  'list_ado_branches', 'list_ado_commit_history', 'list_ado_directory_contents',
  'list_ado_pipeline_runs', 'list_ado_pipelines', 'list_ado_projects', 'list_ado_repos',
  'list_branches', 'list_commit_history', 'list_database_schemas', 'list_directory_contents',
  'list_github_actions', 'list_github_workflow_runs', 'list_github_workflows',
  'list_kubernetes_configmaps', 'list_kubernetes_cronjobs', 'list_kubernetes_daemonsets',
  'list_kubernetes_deployments', 'list_kubernetes_events', 'list_kubernetes_ingresses',
  'list_kubernetes_jobs', 'list_kubernetes_namespaces', 'list_kubernetes_nodes',
  'list_kubernetes_persistent_volume_claims', 'list_kubernetes_persistent_volumes',
  'list_kubernetes_pods', 'list_kubernetes_replicasets', 'list_kubernetes_secrets',
  'list_kubernetes_services', 'list_kubernetes_statefulsets', 'list_public_repos',
  'list_schema_objects', 'plan_route', 'run_adhoc_sql', 'run_ado_pipeline', 'save_code_to_file',
  'scale_kubernetes_deployment', 'scan_network_for_ssh', 'search_docker_images',
  'select_database_data', 'switch_ado_branch', 'switch_branch', 'test_ssh_connect',
  'update_kubernetes_resource',
].sort();

let originalEnv;

beforeEach(() => {
  originalEnv = {};
  INTEGRATION_ENV_VARS.forEach((key) => {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  });
});

afterEach(() => {
  INTEGRATION_ENV_VARS.forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  });
});

describe('getToolDefinitions - integration gating', () => {
  test('with no integration env vars set, only the always-on system info tools are returned', () => {
    const names = getToolDefinitions().map((t) => t.name).sort();
    assert.deepEqual(names, [...SYSTEM_INFO_TOOL_NAMES].sort());
  });

  test('GITHUB_TOKEN enables GitHub, GitHub Actions, and code review tools', () => {
    process.env.GITHUB_TOKEN = 'dummy';
    const names = getToolDefinitions().map((t) => t.name);
    assert.equal(names.length, 6 + 15 + 6 + 1); // system info + github + actions + code review
    assert.ok(names.includes('create_repo'));
    assert.ok(names.includes('list_github_actions'));
    assert.ok(names.includes('github_file_review'));
    assert.ok(!names.includes('create_ado_repo'));
  });

  test('AZURE_DEVOPS_PAT enables ADO and ADO code review tools', () => {
    process.env.AZURE_DEVOPS_PAT = 'dummy';
    const names = getToolDefinitions().map((t) => t.name);
    assert.equal(names.length, 6 + 20 + 1); // system info + ado + ado code review
    assert.ok(names.includes('create_ado_repo'));
    assert.ok(names.includes('ado_file_review'));
    assert.ok(!names.includes('create_repo'));
  });

  test('DOSA tool requires all four DOSA_* env vars - any subset leaves it disabled', () => {
    process.env.DOSA_API_KEY = 'x';
    process.env.DOSA_API_SECRET = 'x';
    process.env.DOSA_AUTH_TENANT_ID = 'x';
    // DOSA_CLIENT_ID intentionally left unset
    let names = getToolDefinitions().map((t) => t.name);
    assert.ok(!names.includes('get_mot_history'));

    process.env.DOSA_CLIENT_ID = 'x';
    names = getToolDefinitions().map((t) => t.name);
    assert.ok(names.includes('get_mot_history'));
  });

  test('MAPS_API_KEY enables the two mapping tools', () => {
    process.env.MAPS_API_KEY = 'dummy';
    const names = getToolDefinitions().map((t) => t.name);
    assert.equal(names.length, 6 + 2);
    assert.ok(names.includes('plan_route'));
    assert.ok(names.includes('generate_Maps_link'));
  });

  test('Kubernetes tools require both KUBERNETES_API_ENDPOINT and KUBERNETES_BEARER_TOKEN', () => {
    process.env.KUBERNETES_API_ENDPOINT = 'https://example.invalid';
    let names = getToolDefinitions().map((t) => t.name);
    assert.ok(!names.includes('list_kubernetes_pods'));
    assert.ok(!names.includes('get_docker_tags')); // docker hub tools ride along with k8s

    process.env.KUBERNETES_BEARER_TOKEN = 'dummy';
    names = getToolDefinitions().map((t) => t.name);
    assert.equal(names.length, 6 + 27 + 2); // system info + kubernetes + docker hub
    assert.ok(names.includes('list_kubernetes_pods'));
    assert.ok(names.includes('get_docker_tags'));
  });

  test('DATABASE_URI enables the database tools', () => {
    process.env.DATABASE_URI = 'postgres://example.invalid/db';
    const names = getToolDefinitions().map((t) => t.name);
    assert.equal(names.length, 6 + 6);
    assert.ok(names.includes('run_adhoc_sql'));
  });

  test('with every integration enabled, the tool set exactly matches the migrated registry', () => {
    process.env.GITHUB_TOKEN = 'x';
    process.env.AZURE_DEVOPS_PAT = 'x';
    process.env.DOSA_API_KEY = 'x';
    process.env.DOSA_API_SECRET = 'x';
    process.env.DOSA_AUTH_TENANT_ID = 'x';
    process.env.DOSA_CLIENT_ID = 'x';
    process.env.MAPS_API_KEY = 'x';
    process.env.KUBERNETES_API_ENDPOINT = 'x';
    process.env.KUBERNETES_BEARER_TOKEN = 'x';
    process.env.DATABASE_URI = 'x';

    const tools = getToolDefinitions();
    const names = tools.map((t) => t.name).sort();

    assert.deepEqual(names, ALL_TOOL_NAMES);
    assert.equal(new Set(names).size, names.length, 'tool names must be unique');
  });
});

describe('getToolDefinitions - structural invariants', () => {
  test('every tool definition is internally consistent, regardless of which integrations are enabled', () => {
    process.env.GITHUB_TOKEN = 'x';
    process.env.AZURE_DEVOPS_PAT = 'x';
    process.env.DOSA_API_KEY = 'x';
    process.env.DOSA_API_SECRET = 'x';
    process.env.DOSA_AUTH_TENANT_ID = 'x';
    process.env.DOSA_CLIENT_ID = 'x';
    process.env.MAPS_API_KEY = 'x';
    process.env.KUBERNETES_API_ENDPOINT = 'x';
    process.env.KUBERNETES_BEARER_TOKEN = 'x';
    process.env.DATABASE_URI = 'x';

    const tools = getToolDefinitions();
    assert.equal(tools.length, 87);

    tools.forEach((tool) => {
      assert.equal(typeof tool.name, 'string');
      assert.ok(tool.name.length > 0);
      assert.equal(typeof tool.func, 'function', `${tool.name} must reference a real function`);
      assert.equal(typeof tool.description, 'string');
      assert.ok(tool.description.length > 0, `${tool.name} needs a non-empty description`);
      assert.ok(Array.isArray(tool.params), `${tool.name}.params must be an array`);
      assert.ok(Array.isArray(tool.required), `${tool.name}.required must be an array`);

      const schemaKeys = Object.keys(tool.parametersSchema || {});

      // 'sessionId' is injected by mcpServer.js/mcpClient.js - a tool must
      // never declare it itself, or it would collide with the injected
      // value and/or leak into the schema shown to the model.
      assert.ok(
        !schemaKeys.includes('sessionId'),
        `${tool.name} must not declare its own 'sessionId' parameter`,
      );
      assert.ok(
        !tool.params.includes('sessionId'),
        `${tool.name}.params must not include 'sessionId'`,
      );

      // Every required parameter must actually be declared in the schema.
      tool.required.forEach((paramName) => {
        assert.ok(
          schemaKeys.includes(paramName),
          `${tool.name}: required param '${paramName}' is missing from parametersSchema`,
        );
      });

      // Every positional param pulled out at call time must be declared in
      // the schema too, or it would silently always be undefined.
      tool.params.forEach((paramName) => {
        assert.ok(
          schemaKeys.includes(paramName),
          `${tool.name}: params entry '${paramName}' is missing from parametersSchema`,
        );
      });
    });
  });
});
