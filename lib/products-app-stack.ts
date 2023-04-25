import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { LayerVersion, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface ProductAppStackProps extends StackProps {
  eventsDdb: Table;
}

export class ProductsAppStack extends Stack {
  readonly productsFetchHandler: NodejsFunction;
  readonly productsAdminHandler: NodejsFunction;
  readonly productsDdb: Table;

  constructor(scope: Construct, id: string, props: ProductAppStackProps) {
    super(scope, id, props);

    this.productsDdb = new Table(this, "ProductsDdb", {
      tableName: "products",
      removalPolicy: RemovalPolicy.DESTROY,
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    });

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

    const productEventsHandler = new NodejsFunction(
      this,
      "ProductsEventsFunction",
      {
        functionName: "ProductsEventsFunction",
        entry: "lambda/products/productsEventsFunction.ts",
        handler: "handler",
        memorySize: 128,
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(2),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          EVENTS_DDB: props.eventsDdb.tableName,
        },
        layers: [productsLayer],
        tracing: Tracing.ACTIVE,
      }
    );

    props.eventsDdb.grantWriteData(productEventsHandler);

    this.productsFetchHandler = new NodejsFunction(
      this,
      "ProductsFetchFunction",
      {
        functionName: "ProductsFetchFunction",
        entry: "lambda/products/productsFetchFunction.ts",
        handler: "handler",
        memorySize: 128,
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(5),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          PRODUCTS_DDB: this.productsDdb.tableName,
        },
        layers: [productsLayer],
        tracing: Tracing.ACTIVE,
      }
    );

    this.productsDdb.grantReadData(this.productsFetchHandler);

    this.productsAdminHandler = new NodejsFunction(
      this,
      "ProductsAdminFunction",
      {
        functionName: "ProductsAdminFunction",
        entry: "lambda/products/productsAdminFunction.ts",
        handler: "handler",
        memorySize: 128,
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(5),
        bundling: {
          minify: true,
          sourceMap: false,
        },
        environment: {
          PRODUCTS_DDB: this.productsDdb.tableName,
          PRODUCTS_EVENT_FUNCTION_NAME: productEventsHandler.functionName,
        },
        layers: [productsLayer],
        tracing: Tracing.ACTIVE,
      }
    );

    this.productsDdb.grantWriteData(this.productsAdminHandler);
    productEventsHandler.grantInvoke(this.productsAdminHandler);
  }
}
