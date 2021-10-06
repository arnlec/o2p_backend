import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
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
    })



    new cdk.CfnOutput(this,'UserPoolId',{value: userPool.userPoolId});
    new cdk.CfnOutput(this,'UserPoolNativeClientId',{value: userPoolNativeClient.userPoolClientId});
    new cdk.CfnOutput(this,'UserPoolWebClientId',{value: userPoolWebClient.userPoolClientId});
  }
}
