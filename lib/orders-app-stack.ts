import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { LayerVersion, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface OrdersAppStackProps extends StackProps {
  productsDdb: Table;
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
      },
      layers: [ordersLayer, productsLayer, ordersApiLayer],
      tracing: Tracing.ACTIVE,
    });

    ordersDdb.grantReadWriteData(this.ordersHandler);
    props.productsDdb.grantReadData(this.ordersHandler);
  }
}
