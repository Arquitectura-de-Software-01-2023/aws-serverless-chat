"use strict";

const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();
const uuid = require("uuid");

const CONNECTION_DB_TABLE = process.env.CONNECTION_DB_TABLE;
const GROUP_TABLE = process.env.GROUP_TABLE;

const successfullResponse = {
  statusCode: 200,
  body: "Success",
};

const failedResponse = (statusCode, error) => ({
  statusCode,
  body: error,
});

module.exports.connectHandler = (event, _context, callback) => {
  console.log("New connection")
  console.log("set params")
  const params = {
    TableName: CONNECTION_DB_TABLE,
    Item: {
      connectionId: event.requestContext.connectionId,
    },
  }; 
  dynamo.put(params, (err, data) => {
    if(err) {
      console.log("Error en connectHandler", err.message);
      callback(failedResponse(500, JSON.stringify(err)));
    } else {
      callback(null, successfullResponse)
    }
  });
}

// set user
module.exports.setUserHandler = (event, _context, callback) => {
  // search by connection id
  const body = JSON.parse(event.body);
  const userSearch = {
    TableName: CONNECTION_DB_TABLE,
    ExpressionAttributeValues: {
      ":connectionId": event.requestContext.connectionId,
    },
    KeyConditionExpression: "connectionId = :connectionId",
  }
  dynamo.query(userSearch, (err, data) => {
    if(err) {
      send({
        message: "Error setting user"
      }, event, event.requestContext.connectionId)
      callback(failedResponse(500, JSON.stringify(err)));
    } else {
      if(data.Items.length > 0) {
        data.Items[0].username = body.username;
        const params = {
          TableName: CONNECTION_DB_TABLE,
          Item: data.Items[0],
        }; 
        dynamo.put(params, (err, data) => {
          if(err) {
            console.log("Error en connectHandler", err.message);
            send({
              message: "Error setting user"
            }, event, event.requestContext.connectionId)
            callback(failedResponse(500, JSON.stringify(err)));
          } else {
            send({
              message: "Successfully set user"
            }, event, event.requestContext.connectionId)
            callback(null, successfullResponse)
          }
        });
      } else {
        send({
          message: "Error setting user"
        }, event, event.requestContext.connectionId)
        callback(failedResponse(500, JSON.stringify(err)));
      }
    }
  });
}


/*
 * DISCONNECT
 */
module.exports.disconnectHandler = (event, _context, callback) => {
  deleteConnection(event.requestContext.connectionId)
    .then(() => {
      console.log(successfullResponse)
      callback(null, successfullResponse);
    })
    .catch((err) => {
      console.log(err);
      callback(failedResponse(500, JSON.stringify(err)));
    });
};

const deleteConnection = (connectionId) => {
  const params = {
    TableName: CONNECTION_DB_TABLE,
    Key: {
      connectionId: connectionId,
    },
  };

  //TODO: delete connection from GROUP_TABLE

  return dynamo.delete(params).promise();
};

/*
 * DEFAULT
 */
module.exports.defaultHandler = (_event, _context, callback) => {
  callback(null, failedResponse(404, "No event found"));
};

/*
 * GROUPS
 */

module.exports.createGroupHandler = (event, _context, callback) => {
  console.log("CreateGroupHandler invocado");
  createGroup(event)
    .then(() => {
      send({
        message: "Successfully created group"
      }, event, event.requestContext.connectionId)
      callback(null, successfullResponse);
    })
    .catch((err) => {
      console.log("Error en createGroupHandler", err.message);
      send({
        message: "Error creating group"
      }, event, event.requestContext.connectionId)
      callback(failedResponse(500, JSON.stringify(err)));
    });
};

const createGroup = (event) => {
  console.log("Llegando a createGroup");
  const body = JSON.parse(event.body);
  console.log("body", body);
  const params = {
    TableName: GROUP_TABLE,
    Item: {
      groupId: uuid.v1(),
      createdBy: event.requestContext.connectionId,
      groupName: body.groupName,
      members: [event.requestContext.connectionId],
    },
  };

  console.log("params", params);

  return dynamo.put(params).promise();
};

module.exports.joinGroupHandler = (event, _context, callback) => {
  const body = JSON.parse(event.body);
  console.log("Join group", body.groupName)
  const searchParams = {
    TableName: GROUP_TABLE,
    ExpressionAttributeValues: {
      ":groupName": body.groupName,
    },
    IndexName: "groupName-index",
    KeyConditionExpression: "groupName = :groupName",
  }
  console.log("search params", searchParams)
  dynamo.query(searchParams, (err, data) => {
    console.log("Query finished")
    if(err) {
      console.log("Error en joinGroup", err.message);
      callback(failedResponse(500, JSON.stringify(err)));
    } else {
      console.log("group", data.Items[0]);
      const members = data.Items[0].members;
      members.push(event.requestContext.connectionId);
      const updateParams = {
        TableName: GROUP_TABLE,
        Key: {
          groupId: data.Items[0].groupId,
        },
        UpdateExpression: "SET members = :members",
        ExpressionAttributeValues: {
          ":members": members,
        },
      };
      dynamo.update(updateParams, (err2,data) => {
        if(err2) {
          send({
            message: "Error joining group"
          }, event, event.requestContext.connectionId)
          console.log("Error en joinGroup", err2.message);
          callback(failedResponse(500, JSON.stringify(err2)));
        } else {
          send({
            message: "Successfully joined group"
          }, event, event.requestContext.connectionId)
          console.log(data);
          callback(null, successfullResponse);
        }
      });
    }
  });
};

/*
 * SEND MESSAGES
 */

module.exports.sendMessageHandler = (event, _context, callback) => {
  const body = JSON.parse(event.body);
  const userDest = body.username;
  const message = body.message;
  const searchParams = {
    TableName: CONNECTION_DB_TABLE,
    ExpressionAttributeValues: {
      ":username": userDest,
    },
    IndexName: "username-index",
    KeyConditionExpression: "username = :username",
  }

  dynamo.query(searchParams, (err, data) => {
    if(err) {
      console.log("Error en sendMessageHandler", err.message);
      send({
        message: "Error sending message"
      }, event, event.requestContext.connectionId);
      callback(failedResponse(500, JSON.stringify(err)));
    } else {
      console.log("data", data);
      if(data.Items.length > 0) {
        console.log("User exists");
        const connectionId = data.Items[0].connectionId;
        send({
          message: message
        }, event, connectionId);
        callback(null, successfullResponse);
      } else {
        console.log("User does not exist");
        send({
          message: "User not found"
        }, event, event.requestContext.connectionId);
        callback(failedResponse(404, "User not found"));
      }
    }
  });
}

module.exports.broadcastMessageHandler = (event, _context, callback) => {
  const body = JSON.parse(event.body);
  const message = body.message;
  const params = {
    TableName: CONNECTION_DB_TABLE,
    ProjectionExpression: "connectionId",
  };
  dynamo.scan(params, (err, data) => {
    if(err) {
      console.log("Error en broadcastMessageHandler", err.message);
      send({
        message: "Error sending message"
      }, event, event.requestContext.connectionId);
      callback(failedResponse(500, JSON.stringify(err)));
    } else {
      console.log("data", data);
      data.Items.forEach((item) => {
        send({
          message: message
        }, event, item.connectionId);
      });
      callback(null, successfullResponse);
    }
  });
}

module.exports.sendMessageToGroupHandler = (event, _context, callback) => {
  const body = JSON.parse(event.body);
  console.log("Send message to group", body.groupName)
  const searchParams = {
    TableName: GROUP_TABLE,
    ExpressionAttributeValues: {
      ":groupName": body.groupName,
    },
    IndexName: "groupName-index",
    KeyConditionExpression: "groupName = :groupName",
  }
  console.log("search params", searchParams)
  dynamo.query(searchParams, (err, data) => {
    if(err) {
      console.log("Group not found")
      send("Group not found", event, event.requestContext.connectionId)
      callback(failedResponse(500, JSON.stringify(err)));
    } else {
      const group = data.Items[0];
      // check if connection id is in group
      if(group.members.includes(event.requestContext.connectionId)) {
        console.log("Group found", group)
        const members = group.members;
        members.forEach((member) => {
          console.log("Sending message to", member)
          send({
            message: body.message
          }, event, member);
        })
        callback(null, successfullResponse);
      } else {
        console.log("User not in group")
        send({
          data: "You are not in this group"
        }, event, event.requestContext.connectionId)
        callback(failedResponse(500, JSON.stringify(err)));
      }
    }
  });
};

const send = (data, event, connectionId) => {
  console.log("Sending...", data);

  const endpoint =
    event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint,
  });
  console.log("hasta aqui");

  const params = {
    ConnectionId: connectionId,
    Data: JSON.stringify(data),
  };
  console.log("Haciendo el postToConnection con params", params);
  return apigwManagementApi.postToConnection(params).promise();
};
