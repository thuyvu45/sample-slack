const AWS_CONSOLE_ENDPOINT = "https://console.aws.amazon.com";
const AWS_CODE_DEPLOY_ENDPOINT = "codesuite/codedeploy/deployments";
const AWS_CODE_PIPELINE_ENDPOINT = "codesuite/codepipeline/pipelines";
const AWS_CODE_PIPELIINE_SUFFIX = "view?region=us-east-1";

const SLACK_API_ENDPOINT = "https://paintzen.slack.com/services/hooks/slackbot";
const DEPLOYMENT_STATES = {
  SUCCESS: "completed",
  FAILURE: "failed",
  START: "started",
  STOP: "stopped",
  SUCCEEDED: "completed",
  FAILED: "failed",
  STOPPED: "stopped",
  READY: "ready",
  STARTED: "started"
};
const DEFAULT_SLACK_CHANNEL = "deployment-status";
const BUILD_STATUS_SLACK_CHANNEL = "build-status";
const RESOURCE_MONITOR_SLACK_CHANNEL = "resource-monitor";
const SYNC_PR_SLACK_CHANNEL = "sync-prs";
const POWERBI_ERRORS_SLACK_CHANNEL = "powerbi-errors";

const AWS_CODE_BUILD_ENDPOINT = "codesuite/codebuild/projects";

module.exports = {
  AWS_CONSOLE_ENDPOINT,
  AWS_CODE_DEPLOY_ENDPOINT,
  AWS_CODE_BUILD_ENDPOINT,
  SLACK_API_ENDPOINT,
  DEPLOYMENT_STATES,
  DEFAULT_SLACK_CHANNEL,
  BUILD_STATUS_SLACK_CHANNEL,
  RESOURCE_MONITOR_SLACK_CHANNEL,
  AWS_CODE_PIPELINE_ENDPOINT,
  AWS_CODE_PIPELIINE_SUFFIX,
  SYNC_PR_SLACK_CHANNEL,
  POWERBI_ERRORS_SLACK_CHANNEL
};
