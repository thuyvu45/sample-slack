const axios = require("axios");
const { SLACK_API_ENDPOINT, DEFAULT_SLACK_CHANNEL } = require("../constant");

async function sendMsg(msg, channel = DEFAULT_SLACK_CHANNEL) {
  try {
    return axios({
      method: "post",
      url: `${SLACK_API_ENDPOINT}?token=${
        process.env.SLACK_TOKEN
      }&channel=${channel}`,
      data: msg
    });
  } catch (err) {
    console.log(`ERROR-SENDING-SLACK-MESSAGE MESSAGE=${err.message}`);
    throw new Error(err);
  }
}

module.exports = {
  sendMsg
};
