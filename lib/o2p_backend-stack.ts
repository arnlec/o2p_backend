import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as appsync from '@aws-cdk/aws-appsync';
import * as lambda from '@aws-cdk/aws-lambda';
import { ClientAttributes } from '@aws-cdk/aws-cognito';

export class O2PBackendStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this,'o2p-user-pool',{
      standardAttributes: {
        email: {
          required: true,
          mutable: false
        }
      },
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification:{
        emailSubject: '[O2P] Verify your new account',
        emailStyle: cognito.VerificationEmailStyle.LINK
      },
      autoVerify:{
        email: true
      },
      passwordPolicy:{
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      }
    }) // UserPool;


    const userPoolDomain = new cognito.UserPoolDomain(this,'o2p-user-pool-domain',{
      userPool,
      cognitoDomain:{domainPrefix:'o2p'}
    });

    const userPoolNativeClient = new cognito.UserPoolClient(this,'o2p-user-pool-native-client',{
      userPool,
      generateSecret: true,
      readAttributes: new ClientAttributes().withStandardAttributes({
        email: true
      })
    });

    const userPoolWebClient = new cognito.UserPoolClient(this,'o2p-user-pool-web-client',{
      userPool,
      generateSecret: false,
      readAttributes: new ClientAttributes().withStandardAttributes({
        email: true
      })
    });

    const identityPool = new cognito.CfnIdentityPool(this,'o2p-identity-pool',{
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders:[
        {
          clientId: userPoolNativeClient.userPoolClientId,
          providerName: userPool.userPoolProviderName
        },
        {
          clientId: userPoolWebClient.userPoolClientId,
          providerName: userPool.userPoolProviderName
        }
      ]
    });

    new cdk.CfnOutput(this,'UserPoolId',{value: userPool.userPoolId});
    new cdk.CfnOutput(this,'UserPoolNativeClientId',{value: userPoolNativeClient.userPoolClientId});
    new cdk.CfnOutput(this,'UserPoolWebClientId',{value: userPoolWebClient.userPoolClientId});


    // https://theskenengineering.com/accessing-dynamodb-with-aws-amplify/
    // https://phatrabbitapps.com/building-full-stack-serverless-application-with-amplify-flutter-graphql-aws-cdk-and-typescript
    // https://phatrabbitapps.com/building-full-stack-serverless-application-with-amplify-flutter-graphql-aws-cdk-and-typescriptpart-2

    const api = new appsync.GraphqlApi(this,"o2p-api",{
        name: 'o2p_appsync_api',
        schema: appsync.Schema.fromAsset("assets/schema.graphql"),
        authorizationConfig:{
          defaultAuthorization: {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig:{
              expires: cdk.Expiration.after(cdk.Duration.days(365))
            }
          },
          additionalAuthorizationModes: [
            {
              authorizationType: appsync.AuthorizationType.USER_POOL,
              userPoolConfig:{
                userPool
              }
            }
          ]
        },
        xrayEnabled: true
    });
    new cdk.CfnOutput(this,"o2p-api-url",{value: api.graphqlUrl});
    new cdk.CfnOutput(this,"o2p-api-key",{value: api.apiKey || ""});


    const appSyncApiLambda = new lambda.Function(this,"o2p-appsync-handler",{
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "api.handler",
      code: lambda.Code.fromAsset("assets/lambda"),
      memorySize: 1024
    });

    const appSyncApiDatasource = api.addLambdaDataSource("o2p_lambda_datasource",appSyncApiLambda);
    appSyncApiDatasource.createResolver({
      typeName: "Query",
      fieldName: "getById"
    });
    appSyncApiDatasource.createResolver({
      typeName: "Query",
      fieldName: "getAll"
    });
    appSyncApiDatasource.createResolver({
      typeName: "Mutation",
      fieldName: "create"
    });
    appSyncApiDatasource.createResolver({
      typeName: "Mutation",
      fieldName: "remove"
    });
    appSyncApiDatasource.createResolver({
      typeName: "Mutation",
      fieldName: "update"
    });

    const table = new dynamodb.Table(this,'o2p',{
      partitionKey: {name:'id',type: dynamodb.AttributeType.STRING}
    });
    table.grantReadWriteData(appSyncApiLambda);
    appSyncApiLambda.addEnvironment("O2P_TABLE_NAME",table.tableName);

    new cdk.CfnOutput(this,'o2p-table',{value:table.tableName});

  }
}
