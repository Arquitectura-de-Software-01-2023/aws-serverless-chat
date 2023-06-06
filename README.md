# AWS Websocket API Chat

![plot](./assets/aws-architecture.jpg)

In order to deploy the example, you need to run the following command:

```
$ serverless deploy
```

After running deploy, you should see output similar to:

```bash
Deploying sls-chat-v2 to stage dev (us-east-1)

✔ Service deployed to stack sls-chat-v2-dev (112s)
```

Once that the URL is shown, you have to use a wss client like wscat.

To intall wscat, run the following command:

```bash
npm install -g wscat
```

Once that the wss client is installed, run the following command with the URL.

```bash
wscat -c wss://<aws-url>
```

The following actions can be done on wscat:

* Setting the user (this action should be done first)

  ```json
  {"action": "setUser", "username": "RadoV18"}
  ```
  
* Creating a group

  ```json
  {"action": "createGroup", "groupName": "testGroup"}
  ```

* Joining a group

  ```json
  {"action": "joinGroup", "groupName": "testGroup"}
  ```

* Send a message to a user

  ```json
  {"action": "sendMessage", "username": "RadoV18", "message": "Hello World!"}
  ```

* Send a broadcast message to all the users

  ```json
  {"action": "broadcastMessage", "message": "Broadcast message to everyone"}
  ```

* Send a message to a group

  ```json
  {"action": "sendMessageToGroup", "groupName": "testGroup1", "message": "Hello Group 1"}
  ```
