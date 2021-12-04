import { CfnWaitConditionHandle } from "@aws-cdk/aws-applicationautoscaling/node_modules/@aws-cdk/core";
import * as AWS from "aws-sdk";
const document = new AWS.DynamoDB.DocumentClient();
const defaultTableName = "o2p"; 
const tableName = process.env.O2P_TABLE_NAME || defaultTableName;

type Chicken = {
    id: string;
    name: string;
    eggsCount: number;
};

async function create(chicken: Chicken){
    try{
        await document.put({ 
            TableName: tableName,
            Item: chicken
        })
        .promise();
        return chicken;
    }
    catch(err){
        console.log("DynamoDB error: ",err);
        return null;
    }
}; 

type UpdateParameters ={
    TableName: string;
    Key: any,
    ExpressionAttributeValues: any;
    ExpressionAttributeNames: any;
    UpdateExpression: string;
    ReturnValues: string;
};

async function update(chicken: any){
    let parameters : UpdateParameters ={
        TableName: tableName,
        Key : {
            id: chicken.id,
        },
        ExpressionAttributeNames: {},
        ExpressionAttributeValues: {},
        UpdateExpression: "",
        ReturnValues: "UPDATED_NEW",
    };
    let prefix = "set ";
    Object.keys(chicken)
        .filter(attr => attr !== "id")
        .forEach( attr => {
            parameters.UpdateExpression += prefix+"#"+attr+" = :" + attr;
            parameters.ExpressionAttributeValues[":"+attr] = chicken[attr];
            parameters.ExpressionAttributeNames["#"+attr] = attr
            prefix = ",";
        });
    console.log("parameters: ",parameters);
    try{
        await document.update(parameters).promise();
        return chicken;
    }
    catch(err){
        console.log("DynamoDB error: ",err);
        return null;
    }
}; // update


async function getById(id: string){
    try{
        const { Item } = await document.get({
            TableName : tableName,
            Key: {id : id},
        }).promise();
        return Item;
    }
    catch(err){
        console.log("DynamoDB error: ",err);
        return null;
    }
};  // getById


async function getAll(){
    try{
        const data = await document.scan({
            TableName: tableName,
        }).promise();
        return data.Items || [];
    }
    catch(err){
        console.log("DynamoDB error: ",err);
        return [];
    }
}; // getAll


async function remove(id: string){
    try{
        await document.delete({
            TableName : tableName,
            Key: {id : id},
        }).promise();
        return id;
    }
    catch(err){
        console.log("DynamoDB error: ",err);
        return null;
    }
}; // remove


type AppSyncEvent = {
    info: {
        fieldName: string;
    };
    arguments: {
        id: string;
        chicken: Chicken;
    };
};

exports.handler = async (event: AppSyncEvent) => {
    switch(event.info.fieldName){
        case "getById":
            return await getById(event.arguments.id);
        case "create":
            return await create(event.arguments.chicken);
        case "getAll":
            return await getAll();
        case "remove":
            return await remove(event.arguments.id);
        case "update":
            return await update(event.arguments.chicken);
        default:
            return null;
    }
};

