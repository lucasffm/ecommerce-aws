import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LayerVersion, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Topic } from "aws-cdk-lib/aws-sns";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface OrdersAppStackProps extends StackProps {
  productsDdb: Table;
  eventsDdb: Table;
}

export class OrdersAppStack extends Stack {
  readonly ordersHandler: NodejsFunction;

  constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
    super(scope, id, props);

    const ordersDdb = new Table(this, "OrdersDdb", {
      tableName: "orders",
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    });

    // Orders Layer
    const ordersLayerArn = StringParameter.valueForStringParameter(
      this,
      "OrdersLayerVersionArn"
    );

    const ordersLayer = LayerVersion.fromLayerVersionArn(
      this,
      "OrdersLayerVersionArn",
      ordersLayerArn
    );

    // Orders Api Layer
    const ordersApiLayerArn = StringParameter.valueForStringParameter(
      this,
      "OrdersApiLayerVersionArn"
    );

    const ordersApiLayer = LayerVersion.fromLayerVersionArn(
      this,
      "OrdersApiLayerVersionArn",
      ordersApiLayerArn
    );

    // Order Event Layer
    const orderEventsLayerArn = StringParameter.valueForStringParameter(
      this,
      "OrderEventsLayerVersionArn"
    );

    const orderEventsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "OrderEventsLayerVersionArn",
      orderEventsLayerArn
    );

    // Order Event Repository Layer
    const orderEventsRepositoryLayerArn =
      StringParameter.valueForStringParameter(
        this,
        "OrderEventsRepositoryLayerVersionArn"
      );

    const orderEventsRepositoryLayer = LayerVersion.fromLayerVersionArn(
      this,
      "OrderEventsRepositoryLayerVersionArn",
      orderEventsRepositoryLayerArn
    );

    // Products Layer
    const productsLayerArn = StringParameter.valueForStringParameter(
      this,
      "ProductsLayerVersionArn"
    );

    const productsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "ProductsLayerVersionArn",
      productsLayerArn
    );

    const ordersTopic = new Topic(this, "OrderEventsTopic", {
      displayName: "Order Events Topic",
      topicName: "order-events",
    });

    this.ordersHandler = new NodejsFunction(this, "OrdersFunction", {
      functionName: "OrdersFunction",
      entry: "lambda/orders/ordersFunction.ts",
      handler: "handler",
      memorySize: 128,
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        PRODUCTS_DDB: props.productsDdb.tableName,
        ORDERS_DDB: ordersDdb.tableName,
        ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn,
      },
      layers: [ordersLayer, productsLayer, ordersApiLayer, orderEventsLayer],
      tracing: Tracing.ACTIVE,
    });

    ordersDdb.grantReadWriteData(this.ordersHandler);
    props.productsDdb.grantReadData(this.ordersHandler);
    ordersTopic.grantPublish(this.ordersHandler);

    const orderEventsHandler = new NodejsFunction(this, "OrderEventsFunction", {
      functionName: "OrderEventsFunction",
      entry: "lambda/orders/orderEventsFunction.ts",
      handler: "handler",
      memorySize: 128,
      runtime: Runtime.NODEJS_16_X,
      timeout: Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        EVENTS_DDB: props.eventsDdb.tableName,
      },
      layers: [orderEventsLayer, orderEventsRepositoryLayer],
      tracing: Tracing.ACTIVE,
    });

    ordersTopic.addSubscription(new LambdaSubscription(orderEventsHandler));

    const eventsDdbPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["dynamodb:PutItem"],
      resources: [props.eventsDdb.tableArn],
      conditions: {
        ["ForAllValues:StringLike"]: {
          "dynamodb:LeadingKeys": ["#order_*"],
        },
      },
    });
    orderEventsHandler.addToRolePolicy(eventsDdbPolicy);
  }
}
