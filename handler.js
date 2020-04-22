"use strict";

const slack = require("./lib/services/slack");
const {
  AWS_CONSOLE_ENDPOINT,
  AWS_CODE_DEPLOY_ENDPOINT,
  DEPLOYMENT_STATES,
  AWS_CODE_BUILD_ENDPOINT,
  BUILD_STATUS_SLACK_CHANNEL,
  RESOURCE_MONITOR_SLACK_CHANNEL,
  AWS_CODE_PIPELINE_ENDPOINT,
  AWS_CODE_PIPELIINE_SUFFIX,
  SYNC_PR_SLACK_CHANNEL,
  POWERBI_ERRORS_SLACK_CHANNEL
} = require("./lib/constant");

const { STEP_FUNCTION_BASE_URL } = require("./constants");
var twistlock = require('./twistlock');

module.exports.index = async (event, context, callback) => {
  try {
    const { detail = {} } = event;
    const applicationName = detail.application;
    const environment = detail.deploymentGroup;
    const state = DEPLOYMENT_STATES[detail.state];
    const deploymentLogLink = `${AWS_CONSOLE_ENDPOINT}/${AWS_CODE_DEPLOY_ENDPOINT}/${
      detail.deploymentId
    }`;

    const message = [
      `A deployment has ${state} for ${applicationName} \n`,
      `*Environment:* ${environment} \n`,
      `*Source:* AWS CodeDeploy \n`,
      `*Status:* ${detail.state} \n`,
      `*View Deployment Logs:* ${deploymentLogLink}\n`
    ].join("");

    await slack.sendMsg(message);

    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};

module.exports.index = twistlock.asyncHandler(module.exports.index);

module.exports.facilitySourceNotification = async (
  event,
  context,
  callback
) => {
  try {
    console.log({ event });
    let message = [
      `There was an error with the Facility Source Integration Pipeline \n`
    ];
    if (event.workOrder) {
      message.push(
        `The following work order number could not be fully processed: ${
          event.workOrder
        }\n`
      );
      if (event.errorMessage && !event.isBusiness) {
        message.push(`Error: ${event.errorMessage}\n`);
      } else if (event.isBusiness) {
        message.push(
          "Please process this work order manually. If you need further assistance, contact the tech team."
        );
      }
    } else {
      message.push(`Failed work order number could not be determined.\n`);
    }

    message = message.join("");

    await slack.sendMsg(message, event.destinationChannel);
  } catch (err) {
    callback(err);
  }
};

module.exports.athenaErrorBusinessNotification = async (
  event,
  context,
  callback
) => {
  try {
    const { Cause } = event.error;
    const errorData = JSON.parse(Cause);
    const parsedMessages = JSON.parse(errorData.errorMessage);

    if (!parsedMessages.businessMessage) return;

    const errorMessages = [
      `There was an error with the Athena Integration Pipeline. \n`
    ];

    errorMessages.push(`${parsedMessages.businessMessage}.\n`);

    errorMessages.push(
      "The Tech team was notified of this issue and is looking into what caused it. Contact the team if you need further assistance.\n"
    );
    if (event.execution) {
      const splitId = event.execution.Id.split(":");
      const businessErrorId = splitId[splitId.length - 1];
      errorMessages.push(`Error ID: ${businessErrorId} \n`);
    }

    const slackMessage = errorMessages.join("");

    await slack.sendMsg(slackMessage, event.destinationChannel);
  } catch (err) {
    callback(err);
  }
};

module.exports.athenaErrorDevNotification = async (
  event,
  context,
  callback
) => {
  try {
    const errorMessages = [
      `There was an error with the Athena Integration Pipeline \n`
    ];
    if (event.stepFunction) {
      errorMessages.push(
        `The error happened in ${
          event.stepFunction.Name
            ? event.stepFunction.Name
            : event.stepFunction.Id
        }\n`
      );
    }

    if (event.error) {
      const { Cause } = event.error;
      const errorData = JSON.parse(Cause);
      const parsedMessages = JSON.parse(errorData.errorMessage);
      errorMessages.push(`Error Name: ${errorData.errorType}\n`);
      errorMessages.push(
        `Error Message: ${parsedMessages.message || errorData.errorMessage}\n`
      );
    }

    if (event.execution) {
      errorMessages.push(
        `Execution: ${STEP_FUNCTION_BASE_URL}${event.execution.Id} \n `
      );
    }

    const slackMessage = errorMessages.join("");
    await slack.sendMsg(slackMessage, event.destinationChannel);
  } catch (err) {
    callback(err);
  }
};

module.exports.buildStatus = async (event, context, callback) => {
  try {
    const { detail = {} } = event;
    const applicationName = detail["project-name"];
    const rawState = detail["build-status"];
    const state = DEPLOYMENT_STATES[rawState];
    const buildspec = detail["additional-information"].source.buildspec;
    const deploymentLogLink = `${AWS_CONSOLE_ENDPOINT}/${AWS_CODE_BUILD_ENDPOINT}/${
      detail["project-name"]
    }`;

    const message = [
      `A build has ${state} for ${applicationName} \n`,
      `*Status:* ${rawState} \n`,
      `*Source:* AWS CodeBuild \n`,
      `*View CodeBuild Logs:* ${deploymentLogLink}\n`,
      `*Build Spec:* ${buildspec}\n`
    ].join("");

    await slack.sendMsg(message, BUILD_STATUS_SLACK_CHANNEL);

    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};

module.exports.deploymentLambdaStatus = async (event, context, callback) => {
  try {
    const { detail = {} } = event;
    const applicationName = detail["project-name"];
    const rawState = detail["build-status"];
    const state = DEPLOYMENT_STATES[rawState];
    const buildspec = detail["additional-information"].source.buildspec;
    const deploymentLogLink = `${AWS_CONSOLE_ENDPOINT}/${AWS_CODE_BUILD_ENDPOINT}/${
      detail["project-name"]
    }`;

    const message = [
      `A deployment has ${state} for ${applicationName} \n`,
      `*Status:* ${rawState} \n`,
      `*Source:* AWS CodeBuild \n`,
      `*View CodeBuild Logs:* ${deploymentLogLink}\n`,
      `*Build Spec:* ${buildspec}\n`
    ].join("");

    await slack.sendMsg(message);

    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};

module.exports.resourceMonitoring = async (event, context, callback) => {
  try {
    const subject = event.Records[0].Sns.Subject;
    const rawMessage = event.Records[0].Sns.Message;
    const timestamp = event.Records[0].Sns.Timestamp;
    const jsonMessage = JSON.parse(rawMessage);
    const alarmName = jsonMessage.AlarmName;
    const alarmDesc = jsonMessage.AlarmDescription;

    if (jsonMessage.Trigger.Dimensions.length > 0) {
      const resourceType = jsonMessage.Trigger.Dimensions[0].name;
      const resourceValue = jsonMessage.Trigger.Dimensions[0].value;
      const message = [
        `An alarm has *${alarmName}* with description *${alarmDesc}* is issued.\n`,
        `*Resource Type:* ${resourceType}.\n`,
        `*Resource Value:* ${resourceValue}.\n`,
        `*Timestamp:* ${timestamp} \n`
      ].join("");
      await slack.sendMsg(message, RESOURCE_MONITOR_SLACK_CHANNEL);
    } else {
      const message = [
        `An alarm has *${alarmName}* with description *${alarmDesc}* is issued.\n`,
        `*Timestamp:* ${timestamp} \n`,
        `*Message:* ${rawMessage} \n`
      ].join("");
      await slack.sendMsg(message, "resource-monitor");
    }
    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};

module.exports.pipelineStatus = async (event, context, callback) => {
  try {
    console.log(event);
    const { detail = {} } = event;
    const applicationName = detail["pipeline"];
    const rawState = detail["state"];
    const state = DEPLOYMENT_STATES[rawState];
    const id = detail["execution-id"];
    const codepipelineLink = `${AWS_CONSOLE_ENDPOINT}/${AWS_CODE_PIPELINE_ENDPOINT}/${applicationName}/${AWS_CODE_PIPELIINE_SUFFIX}`;

    const message = [
      `A pipeline has ${state} for ${applicationName} \n`,
      `*Status:* ${rawState} \n`,
      `*Execution ID:* ${id} \n`,
      `*Source:* AWS CodePipeline \n`,
      `*View Codepipeline:* ${codepipelineLink}\n`
    ].join("");

    await slack.sendMsg(message, BUILD_STATUS_SLACK_CHANNEL);

    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};

module.exports.syncPrFailure = async (event, context, callback) => {
  try {
    const { detail = {} } = event;
    const applicationName = detail["project-name"];
    const deploymentLogLink = `${AWS_CONSOLE_ENDPOINT}/${AWS_CODE_BUILD_ENDPOINT}/${
      detail["project-name"]
    }`;

    const message = [
      `Automatic sync pr for ${applicationName} ${DEPLOYMENT_STATES.FAILED} \n`,
      `*Source:* AWS CodeBuild \n`,
      `*View CodeBuild Logs:* ${deploymentLogLink}\n`
    ].join("");

    await slack.sendMsg(message, SYNC_PR_SLACK_CHANNEL);

    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};

module.exports.powerBIMonitoring = async (event, context, callback) => {
  try {
    const { detail = {} } = event;
    const applicationName = detail["project-name"];
    const deploymentLogLink = `${AWS_CONSOLE_ENDPOINT}/${AWS_CODE_BUILD_ENDPOINT}/${
      detail["project-name"]
    }`;

    const message = [
      `PowerBI process fails overnight. Please check build job for more information. \n`,
      `*Source:* AWS CodeBuild \n`,
      `*View CodeBuild Logs:* ${deploymentLogLink}\n`
    ].join("");

    await slack.sendMsg(message, POWERBI_ERRORS_SLACK_CHANNEL);

    callback(null, "Slack Message has been sent");
  } catch (err) {
    callback(err);
  }
};
