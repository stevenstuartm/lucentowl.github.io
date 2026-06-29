---
title: "Serverless Architecture Patterns on AWS"
layout: guide
category: AWS
subcategory: Serverless Architecture
description: "Event-driven patterns, CQRS, saga orchestration, observability, cost optimization, and anti-patterns for serverless applications on AWS"
tags: [aws, serverless, architecture, event-driven, patterns, cost-optimization]
---

## What Problem This Solves

**The Serverless Architecture Challenge**:
Serverless computing (Lambda, API Gateway, DynamoDB, etc.) enables rapid development and automatic scaling, but poorly designed serverless architectures suffer from:
- **Tight coupling** between services leading to cascading failures
- **Cold start latency** impacting user experience
- **Runaway costs** from inefficient designs
- **Difficult debugging** across distributed event-driven flows
- **State management** challenges in stateless functions

**What This Guide Provides**:
Proven architectural patterns for building production-grade serverless applications:
- Event-driven patterns (pub/sub, choreography, orchestration)
- CQRS (Command Query Responsibility Segregation)
- Observability and debugging strategies
- Cost optimization techniques
- Common anti-patterns to avoid

---

## Core Serverless Principles

### 1. Single Responsibility Functions

**Pattern**: Each Lambda function does one thing well.

**Why it matters**:
- Faster cold starts (smaller deployment packages)
- Easier testing and debugging
- Independent scaling per function
- Reduced blast radius for failures

**Example**:

```python
# ❌ BAD: Monolithic function (multiple responsibilities)
def lambda_handler(event, context):
    if event['action'] == 'create_user':
        # User creation logic (200 lines)
        validate_user(event['user'])
        save_to_database(event['user'])
        send_welcome_email(event['user'])
        update_analytics(event['user'])

    elif event['action'] == 'delete_user':
        # User deletion logic (150 lines)
        validate_deletion(event['user_id'])
        delete_from_database(event['user_id'])
        archive_user_data(event['user_id'])

    elif event['action'] == 'update_user':
        # User update logic (180 lines)
        # ...

# Result:
# - Large deployment package (slow cold starts)
# - All users pay latency cost even for simple operations
# - Hard to test individual operations
# - Changes to one operation risk breaking others

# ✅ GOOD: Single-responsibility functions
def create_user_handler(event, context):
    """Handle user creation only"""
    user = event['user']

    # Validate
    if not validate_user(user):
        return {'statusCode': 400, 'body': 'Invalid user'}

    # Save
    save_to_database(user)

    # Publish event for downstream processing
    sns.publish(
        TopicArn='arn:aws:sns:us-east-1:123456789012:user-created',
        Message=json.dumps({'user_id': user['id'], 'email': user['email']})
    )

    return {'statusCode': 201, 'body': json.dumps({'user_id': user['id']})}

def send_welcome_email_handler(event, context):
    """Handle welcome email (triggered by SNS)"""
    message = json.loads(event['Records'][0]['Sns']['Message'])
    send_email(message['email'], template='welcome')

def update_analytics_handler(event, context):
    """Handle analytics update (triggered by SNS)"""
    message = json.loads(event['Records'][0]['Sns']['Message'])
    analytics_service.track_user_created(message['user_id'])

# Result:
# - create_user: 50KB package, 200ms cold start
# - send_email: 30KB package, 150ms cold start
# - update_analytics: 25KB package, 100ms cold start
# - Each function scales independently
# - Failures isolated (email failure doesn't affect user creation)
```

### 2. Asynchronous Event-Driven Processing

**Pattern**: Use events for communication instead of direct invocation.

**Why it matters**:
- Decouples services (sender doesn't wait for receiver)
- Built-in retry logic (SQS, EventBridge)
- Easier to add new consumers without changing producers

**Example**:

```python
# ❌ BAD: Synchronous chaining (tight coupling)
def create_order_handler(event, context):
    order = event['order']

    # Save order (synchronous)
    order_id = save_order(order)

    # Invoke payment function (synchronous, tight coupling)
    lambda_client = boto3.client('lambda')
    payment_response = lambda_client.invoke(
        FunctionName='process-payment',
        InvocationType='RequestResponse',  # Synchronous
        Payload=json.dumps({'order_id': order_id, 'amount': order['total']})
    )

    # If payment function fails or times out, entire request fails
    # If payment takes 5 seconds, user waits 5 seconds

    if payment_response['StatusCode'] != 200:
        # Complex error handling needed
        rollback_order(order_id)
        return {'statusCode': 500}

    # Invoke shipping function (another synchronous call)
    shipping_response = lambda_client.invoke(
        FunctionName='schedule-shipping',
        InvocationType='RequestResponse',
        Payload=json.dumps({'order_id': order_id})
    )

    return {'statusCode': 200, 'body': json.dumps({'order_id': order_id})}

# Problems:
# - User waits for payment + shipping (slow response)
# - Payment failure causes order rollback (complex)
# - Hard to add new post-order steps (modify create_order code)

# ✅ GOOD: Asynchronous event-driven (loose coupling)
def create_order_handler(event, context):
    order = event['order']

    # Save order
    order_id = save_order(order)

    # Publish event (asynchronous, fire-and-forget)
    eventbridge = boto3.client('events')
    eventbridge.put_events(
        Entries=[{
            'Source': 'order-service',
            'DetailType': 'OrderCreated',
            'Detail': json.dumps({
                'order_id': order_id,
                'customer_id': order['customer_id'],
                'total': order['total'],
                'items': order['items']
            })
        }]
    )

    # Return immediately (user doesn't wait)
    return {'statusCode': 202, 'body': json.dumps({'order_id': order_id})}

# Separate functions subscribe to OrderCreated event
def process_payment_handler(event, context):
    """Triggered by OrderCreated event"""
    detail = event['detail']
    process_payment(detail['order_id'], detail['total'])

    # Publish PaymentProcessed event (for next steps)
    eventbridge.put_events(
        Entries=[{
            'Source': 'payment-service',
            'DetailType': 'PaymentProcessed',
            'Detail': json.dumps({'order_id': detail['order_id']})
        }]
    )

def schedule_shipping_handler(event, context):
    """Triggered by PaymentProcessed event"""
    detail = event['detail']
    schedule_shipping(detail['order_id'])

# Benefits:
# - User gets instant response (order_id)
# - Payment and shipping run asynchronously
# - Easy to add new subscribers (e.g., send confirmation email)
# - Each function can retry independently
# - No complex rollback logic
```

---

## Event-Driven Patterns

### Pattern 1: Pub/Sub with SNS

**Use case**: Fan-out messages to multiple consumers.

**Architecture**:
```
Producer (Lambda) → SNS Topic → Subscriber 1 (Lambda)
                              → Subscriber 2 (Lambda)
                              → Subscriber 3 (SQS → Lambda)
```

**Example**: User registration triggers multiple downstream actions.

```python
import boto3
import json

sns = boto3.client('sns')

def register_user_handler(event, context):
    """User registration (producer)"""
    user = json.loads(event['body'])

    # Save user to database
    user_id = save_user(user)

    # Publish to SNS topic
    sns.publish(
        TopicArn='arn:aws:sns:us-east-1:123456789012:user-registered',
        Subject='User Registered',
        Message=json.dumps({
            'user_id': user_id,
            'email': user['email'],
            'name': user['name'],
            'timestamp': context.request_id
        })
    )

    return {
        'statusCode': 201,
        'body': json.dumps({'user_id': user_id})
    }

# Subscriber 1: Send welcome email
def send_welcome_email(event, context):
    message = json.loads(event['Records'][0]['Sns']['Message'])

    ses = boto3.client('ses')
    ses.send_email(
        Source='noreply@company.com',
        Destination={'ToAddresses': [message['email']]},
        Message={
            'Subject': {'Data': 'Welcome to Our Platform'},
            'Body': {'Text': {'Data': f"Hello {message['name']}!"}}
        }
    )

# Subscriber 2: Create CRM contact
def create_crm_contact(event, context):
    message = json.loads(event['Records'][0]['Sns']['Message'])

    # Call CRM API
    requests.post('https://crm-api.com/contacts', json={
        'external_id': message['user_id'],
        'email': message['email'],
        'name': message['name']
    })

# Subscriber 3: Update analytics
def update_analytics(event, context):
    message = json.loads(event['Records'][0]['Sns']['Message'])

    cloudwatch = boto3.client('cloudwatch')
    cloudwatch.put_metric_data(
        Namespace='UserService',
        MetricData=[{
            'MetricName': 'UsersRegistered',
            'Value': 1,
            'Unit': 'Count'
        }]
    )
```

**Cost**: SNS requests $0.50 per million requests. For 1M user registrations × 3 subscribers = $1.50.

### Pattern 2: Queue-Based Load Leveling with SQS

**Use case**: Smooth traffic spikes, control processing rate, guarantee delivery.

**Architecture**:
```
Producer (API Gateway + Lambda) → SQS Queue → Consumer (Lambda with reserved concurrency)
```

**Example**: Process payment batch with controlled concurrency.

```python
import boto3

sqs = boto3.client('sqs')
QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/payment-queue'

# Producer: Accept payment requests
def submit_payment_handler(event, context):
    payment = json.loads(event['body'])

    # Send to SQS (asynchronous, reliable)
    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(payment),
        MessageAttributes={
            'priority': {'StringValue': payment.get('priority', 'normal'), 'DataType': 'String'}
        }
    )

    return {
        'statusCode': 202,
        'body': json.dumps({'message': 'Payment queued for processing'})
    }

# Consumer: Process payments (controlled concurrency)
def process_payment_handler(event, context):
    """
    Lambda configuration:
    - Reserved concurrency: 10 (max 10 concurrent executions)
    - Batch size: 1 (process one message at a time for safety)
    - Visibility timeout: 60 seconds
    """

    for record in event['Records']:
        payment = json.loads(record['body'])

        try:
            # Call payment gateway (3rd party API with rate limits)
            response = payment_gateway.charge(
                amount=payment['amount'],
                card_token=payment['card_token']
            )

            # Save transaction
            save_transaction(payment['order_id'], response['transaction_id'])

            # Message automatically deleted on success

        except Exception as e:
            # Message returns to queue for retry (max 3 times via DLQ)
            print(f"Payment failed: {e}")
            raise  # Let Lambda retry mechanism handle

# Dead Letter Queue handler
def handle_payment_failures(event, context):
    """Process messages that failed after 3 retries"""
    for record in event['Records']:
        payment = json.loads(record['body'])

        # Alert operations team
        sns.publish(
            TopicArn='arn:aws:sns:us-east-1:123456789012:payment-failures',
            Subject='Payment Failed After Retries',
            Message=json.dumps(payment)
        )

        # Refund customer or manual review
        initiate_refund(payment['order_id'])
```

**Benefits**:
- **Load leveling**: 10,000 requests/second → processed at 10/second (controlled)
- **Automatic retries**: Failed messages retry up to 3 times
- **Guaranteed delivery**: Messages persist until successfully processed
- **Cost**: SQS $0.40 per million requests. For 10M payments: $4.

### Pattern 3: Event Choreography with EventBridge

**Use case**: Complex workflows with multiple independent services.

**Architecture**:
```
Service A → EventBridge → Service B (rule: event type = X)
                        → Service C (rule: event type = Y)
                        → Service D (rule: event.amount > 1000)
```

**Example**: E-commerce order processing with event choreography.

```python
import boto3

eventbridge = boto3.client('events')

# Order Service: Publishes OrderPlaced event
def place_order_handler(event, context):
    order = json.loads(event['body'])
    order_id = save_order(order)

    eventbridge.put_events(
        Entries=[{
            'Source': 'ecommerce.orders',
            'DetailType': 'OrderPlaced',
            'Detail': json.dumps({
                'order_id': order_id,
                'customer_id': order['customer_id'],
                'total': order['total'],
                'items': order['items']
            })
        }]
    )

    return {'statusCode': 201, 'body': json.dumps({'order_id': order_id})}

# Inventory Service: Reacts to OrderPlaced (reserve inventory)
def reserve_inventory_handler(event, context):
    """EventBridge Rule: event.source = 'ecommerce.orders' AND event.detail-type = 'OrderPlaced'"""
    order = event['detail']

    reserved = reserve_items(order['items'])

    if reserved:
        # Publish InventoryReserved event
        eventbridge.put_events(
            Entries=[{
                'Source': 'ecommerce.inventory',
                'DetailType': 'InventoryReserved',
                'Detail': json.dumps({'order_id': order['order_id']})
            }]
        )
    else:
        # Publish InventoryUnavailable event
        eventbridge.put_events(
            Entries=[{
                'Source': 'ecommerce.inventory',
                'DetailType': 'InventoryUnavailable',
                'Detail': json.dumps({'order_id': order['order_id']})
            }]
        )

# Payment Service: Reacts to InventoryReserved
def charge_payment_handler(event, context):
    """EventBridge Rule: event.detail-type = 'InventoryReserved'"""
    order_id = event['detail']['order_id']

    # Retrieve order details
    order = get_order(order_id)

    # Charge payment
    transaction_id = charge_customer(order['customer_id'], order['total'])

    # Publish PaymentCharged event
    eventbridge.put_events(
        Entries=[{
            'Source': 'ecommerce.payments',
            'DetailType': 'PaymentCharged',
            'Detail': json.dumps({'order_id': order_id, 'transaction_id': transaction_id})
        }]
    )

# Shipping Service: Reacts to PaymentCharged
def schedule_shipment_handler(event, context):
    """EventBridge Rule: event.detail-type = 'PaymentCharged'"""
    order_id = event['detail']['order_id']

    shipping_label = create_shipping_label(order_id)

    # Publish ShipmentScheduled event
    eventbridge.put_events(
        Entries=[{
            'Source': 'ecommerce.shipping',
            'DetailType': 'ShipmentScheduled',
            'Detail': json.dumps({'order_id': order_id, 'tracking_number': shipping_label})
        }]
    )

# Notification Service: Reacts to multiple events
def send_order_notification_handler(event, context):
    """
    EventBridge Rule:
      event.source = 'ecommerce.*' AND
      (event.detail-type = 'OrderPlaced' OR
       event.detail-type = 'PaymentCharged' OR
       event.detail-type = 'ShipmentScheduled')
    """
    event_type = event['detail-type']
    order_id = event['detail']['order_id']

    if event_type == 'OrderPlaced':
        send_email(order_id, template='order_confirmation')
    elif event_type == 'PaymentCharged':
        send_email(order_id, template='payment_success')
    elif event_type == 'ShipmentScheduled':
        tracking = event['detail']['tracking_number']
        send_email(order_id, template='shipment_tracking', tracking_number=tracking)
```

**Benefits**:
- **Loose coupling**: Services don't know about each other
- **Easy to extend**: Add new services by creating new EventBridge rules
- **Event replay**: EventBridge stores events for replay (debugging, recovery)
- **Cost**: EventBridge $1.00 per million events. For 1M orders × 6 events = $6.

---

## CQRS Pattern (Command Query Responsibility Segregation)

**What it is**: Separate read and write operations using different data models.

**Why use it**:
- Optimize reads and writes independently
- Scale reads separately from writes (read-heavy workloads)
- Support complex queries without impacting write performance

**Architecture**:
```
Writes (Commands):
  API Gateway → Lambda → DynamoDB (write-optimized schema)
                      → DynamoDB Streams → Lambda → Update read model

Reads (Queries):
  API Gateway → Lambda → ElastiCache/DynamoDB GSI (read-optimized schema)
```

**Example**: Product catalog with CQRS.

```python
import boto3

dynamodb = boto3.resource('dynamodb')
products_table = dynamodb.Table('Products')  # Write model
elasticache = boto3.client('elasticache')

# COMMAND: Create product (write-optimized)
def create_product_handler(event, context):
    """Write to DynamoDB (normalized schema)"""
    product = json.loads(event['body'])

    products_table.put_item(Item={
        'product_id': product['id'],
        'name': product['name'],
        'description': product['description'],
        'price': product['price'],
        'category_id': product['category_id'],
        'created_at': datetime.utcnow().isoformat()
    })

    # DynamoDB Streams will trigger read model update

    return {'statusCode': 201}

# Update read model (triggered by DynamoDB Streams)
def update_read_model_handler(event, context):
    """Denormalize for optimized reads"""

    for record in event['Records']:
        if record['eventName'] == 'INSERT':
            product = record['dynamodb']['NewImage']
            product_id = product['product_id']['S']

            # Fetch category details (denormalize)
            category = get_category(product['category_id']['S'])

            # Store in read-optimized format (ElastiCache)
            redis_client = get_redis_client()
            redis_client.set(
                f"product:{product_id}",
                json.dumps({
                    'id': product_id,
                    'name': product['name']['S'],
                    'description': product['description']['S'],
                    'price': float(product['price']['N']),
                    'category': {  # Denormalized category
                        'id': category['id'],
                        'name': category['name'],
                        'slug': category['slug']
                    },
                    'image_url': product.get('image_url', {}).get('S'),
                    'in_stock': True
                }),
                ex=3600  # 1 hour TTL
            )

            # Also update search index (OpenSearch)
            opensearch_client.index(
                index='products',
                id=product_id,
                body={
                    'name': product['name']['S'],
                    'description': product['description']['S'],
                    'category': category['name'],
                    'price': float(product['price']['N'])
                }
            )

# QUERY: Get product details (read-optimized)
def get_product_handler(event, context):
    """Read from ElastiCache (denormalized, fast)"""
    product_id = event['pathParameters']['id']

    # Try cache first
    redis_client = get_redis_client()
    cached = redis_client.get(f"product:{product_id}")

    if cached:
        return {
            'statusCode': 200,
            'body': cached  # Already JSON
        }

    # Cache miss: Rebuild from write model
    product = products_table.get_item(Key={'product_id': product_id})['Item']
    category = get_category(product['category_id'])

    # Reconstruct denormalized view
    denormalized = {
        'id': product_id,
        'name': product['name'],
        'price': product['price'],
        'category': category
    }

    # Cache for future reads
    redis_client.set(f"product:{product_id}", json.dumps(denormalized), ex=3600)

    return {
        'statusCode': 200,
        'body': json.dumps(denormalized)
    }

# QUERY: Search products (read-optimized)
def search_products_handler(event, context):
    """Search using OpenSearch (optimized for full-text search)"""
    query = event['queryStringParameters']['q']

    results = opensearch_client.search(
        index='products',
        body={
            'query': {
                'multi_match': {
                    'query': query,
                    'fields': ['name^2', 'description', 'category']
                }
            },
            'size': 20
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps([hit['_source'] for hit in results['hits']['hits']])
    }
```

**Benefits**:
- **Writes**: Fast inserts to DynamoDB (single-digit ms)
- **Reads**: Cached in ElastiCache (sub-ms latency)
- **Search**: Powered by OpenSearch (full-text, facets, relevance)
- **Scalability**: Read replicas scale independently

**Cost** (for 1M products, 10M reads/month):
- DynamoDB writes: $1.25/million writes
- ElastiCache (r6g.large): ~$100/month
- OpenSearch (t3.small): ~$30/month
- Lambda invocations: $0.20 per million
- **Total**: ~$132/month

---

## Observability Patterns

### Pattern 1: Structured Logging with CloudWatch Logs Insights

**Best practice**: Log structured JSON for queryability.

```python
import json
import logging

# Configure structured logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    # ❌ BAD: Unstructured logging
    logger.info(f"Processing order {event['order_id']} for customer {event['customer_id']}")

    # ✅ GOOD: Structured logging (JSON)
    logger.info(json.dumps({
        'event': 'order_processing_started',
        'order_id': event['order_id'],
        'customer_id': event['customer_id'],
        'order_total': event['total'],
        'request_id': context.request_id,
        'timestamp': datetime.utcnow().isoformat()
    }))

    try:
        process_order(event)

        logger.info(json.dumps({
            'event': 'order_processing_completed',
            'order_id': event['order_id'],
            'duration_ms': get_duration(context),
            'status': 'success'
        }))

    except Exception as e:
        logger.error(json.dumps({
            'event': 'order_processing_failed',
            'order_id': event['order_id'],
            'error': str(e),
            'error_type': type(e).__name__,
            'stack_trace': traceback.format_exc()
        }))
        raise

# Query with CloudWatch Logs Insights:
# fields @timestamp, order_id, event, duration_ms
# | filter event = "order_processing_completed"
# | stats avg(duration_ms) as avg_duration by bin(5m)
```

### Pattern 2: Distributed Tracing with X-Ray

**Best practice**: Enable X-Ray for end-to-end request tracing.

```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Patch AWS SDK calls for automatic tracing
patch_all()

@xray_recorder.capture('process_order')
def process_order(order):
    # Automatically traced: DynamoDB, S3, SNS calls

    # Custom subsegment for business logic
    with xray_recorder.capture('validate_order'):
        validate(order)

    with xray_recorder.capture('charge_payment'):
        payment_response = payment_gateway.charge(order['total'])

        # Add metadata to trace
        xray_recorder.put_metadata('payment_gateway_response', payment_response)
        xray_recorder.put_annotation('order_total', order['total'])

    return payment_response

# X-Ray shows:
# - End-to-end latency breakdown
# - Which service is slow (DynamoDB query? External API?)
# - Error rates by service
# - Cold start vs warm invocation times
```

### Pattern 3: Custom Metrics with CloudWatch Embedded Metric Format

**Best practice**: Emit metrics directly from Lambda logs (no separate API calls).

```python
def lambda_handler(event, context):
    order = event['order']

    # Process order
    result = process_order(order)

    # Emit custom metric (embedded in logs, zero additional latency)
    print(json.dumps({
        '_aws': {
            'Timestamp': int(time.time() * 1000),
            'CloudWatchMetrics': [{
                'Namespace': 'ECommerce',
                'Dimensions': [['Environment', 'OrderType']],
                'Metrics': [
                    {'Name': 'OrderTotal', 'Unit': 'None'},
                    {'Name': 'ProcessingTime', 'Unit': 'Milliseconds'}
                ]
            }]
        },
        'Environment': 'Production',
        'OrderType': order['type'],
        'OrderTotal': order['total'],
        'ProcessingTime': result['duration_ms']
    }))

    # CloudWatch automatically extracts metrics from logs
    # No API calls = zero cost, zero latency impact

# Create CloudWatch alarm on custom metric:
# Metric: ECommerce/OrderTotal
# Statistic: Sum
# Period: 5 minutes
# Threshold: < $10,000 (alert if orders drop)
```

---

## Cost Optimization Patterns

### Pattern 1: Right-Size Memory (CPU Scales with Memory)

<div class="callout callout--tip">
<p class="callout__title">Counterintuitive Cost Optimization</p>
<p>Lambda CPU scales linearly with memory. Increasing memory 8x often costs less because execution is 7-8x faster. The optimal setting is often 512MB-1024MB, not 128MB.</p>
</div>

**Finding**: Lambda CPU scales linearly with memory. Counterintuitively, higher memory can be cheaper.

**Example**:

```python
# Test: Process 1,000 images

# 128 MB configuration:
# - Duration: 60,000ms (60 seconds)
# - Cost: (60,000ms / 1000) × $0.0000002083 per GB-second × 0.125 GB = $0.00156

# 1,024 MB configuration (8× memory):
# - Duration: 8,000ms (8 seconds) - faster CPU!
# - Cost: (8,000ms / 1000) × $0.0000016667 per GB-second × 1 GB = $0.00133

# Result: 8× memory = 15% cheaper (due to faster execution)
```

**Best practice**: Benchmark different memory settings. Optimal is often 512MB-1024MB, not 128MB.

### Pattern 2: Reserved Concurrency for Predictable Workloads

**Use case**: Avoid cold starts for latency-sensitive functions.

```python
# Without reserved concurrency:
# - Cold start: 500-3000ms (unpredictable)
# - Warm invocation: 10-50ms

# With reserved concurrency (keep 10 instances warm):
# - Reserved concurrency: 10
# - Provisioned concurrency: 5 (always warm)
# - Cold starts eliminated for first 5 concurrent requests

# Cost:
# - Reserved concurrency: Free (just reserves capacity)
# - Provisioned concurrency: $0.000004167 per GB-second
#   For 512MB function, 5 provisioned instances:
#   5 × 0.5 GB × 730 hours × 3600 seconds × $0.000004167 = $27/month

# Justification: Eliminate 2-second cold starts for user-facing API
```

### Pattern 3: Use DynamoDB On-Demand for Unpredictable Traffic

**Comparison**:

```
# Provisioned capacity (predictable traffic):
# - 100 WCU × $0.00065/hour × 730 hours = $47.45/month
# - 100 RCU × $0.00013/hour × 730 hours = $9.49/month
# - Total: $56.94/month
# - Handles: 100 writes/sec, 100 reads/sec consistently

# On-Demand (unpredictable, spiky traffic):
# - $1.25 per million write requests
# - $0.25 per million read requests
# - For 1M writes + 5M reads/month:
#   $1.25 + $1.25 = $2.50/month
# - Scales automatically (no capacity planning)

# Breakeven: ~50M requests/month
# Use On-Demand for: <50M requests/month OR highly variable traffic
# Use Provisioned for: >50M requests/month AND consistent traffic
```

### Pattern 4: S3 Intelligent-Tiering for Data Lakes

**Auto-optimize storage costs**:

```python
# Configure S3 bucket for Intelligent-Tiering
s3 = boto3.client('s3')

s3.put_bucket_intelligent_tiering_configuration(
    Bucket='data-lake-bucket',
    Id='auto-tier',
    IntelligentTieringConfiguration={
        'Id': 'auto-tier',
        'Status': 'Enabled',
        'Tierings': [
            {
                'Days': 90,
                'AccessTier': 'ARCHIVE_ACCESS'  # Move to Glacier after 90 days no access
            },
            {
                'Days': 180,
                'AccessTier': 'DEEP_ARCHIVE_ACCESS'  # Move to Deep Archive after 180 days
            }
        ]
    }
)

# Cost savings:
# - S3 Standard: $0.023/GB-month
# - S3 Intelligent-Tiering (frequent access): $0.023/GB-month
# - S3 Intelligent-Tiering (infrequent access): $0.0125/GB-month (46% savings)
# - S3 Intelligent-Tiering (archive): $0.004/GB-month (83% savings)
# - Monitoring fee: $0.0025 per 1,000 objects

# For 100TB data lake with 70% cold data:
# - Without tiering: 100TB × $0.023 = $2,300/month
# - With tiering: 30TB × $0.023 + 70TB × $0.004 = $690 + $280 = $970/month
# - Savings: $1,330/month (58%)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Long-Running Lambda Functions

**Problem**: Lambda has 15-minute timeout. Long-running jobs waste money and hit limits.

**Example**:
```python
# ❌ BAD: Process 10,000 images in single Lambda invocation
def process_images_handler(event, context):
    images = get_all_images()  # 10,000 images

    for image in images:
        process_image(image)  # 5 seconds each

    # Total: 50,000 seconds = 13.9 hours
    # Result: Lambda times out after 15 minutes
    # Cost: 15 minutes × 1GB = $0.25 (wasted)

# ✅ GOOD: Fan-out to parallel Lambda invocations
def fan_out_handler(event, context):
    images = get_all_images()  # 10,000 images

    # Invoke one Lambda per image (parallel)
    lambda_client = boto3.client('lambda')

    for image in images:
        lambda_client.invoke(
            FunctionName='process-single-image',
            InvocationType='Event',  # Asynchronous
            Payload=json.dumps({'image_id': image['id']})
        )

    # Or use Step Functions for orchestration
    sfn = boto3.client('stepfunctions')
    sfn.start_execution(
        stateMachineArn='arn:aws:states:us-east-1:123456789012:stateMachine:process-images',
        input=json.dumps({'image_ids': [img['id'] for img in images]})
    )

# Result: 10,000 parallel Lambda invocations, each 5 seconds
# Total wall time: 5 seconds (vs 13.9 hours)
# Cost: 10,000 × 5 seconds × 1GB × $0.0000166667 = $0.83
```

### Anti-Pattern 2: Storing State in Lambda /tmp

**Problem**: /tmp is ephemeral and limited to 10GB. Not shared across invocations.

```python
# ❌ BAD: Store session data in /tmp
def login_handler(event, context):
    user_id = authenticate(event['username'], event['password'])

    # Store session in /tmp (WRONG!)
    with open(f'/tmp/session_{user_id}.json', 'w') as f:
        json.dump({'user_id': user_id, 'expires': time.time() + 3600}, f)

    return {'statusCode': 200, 'body': 'Logged in'}

def get_profile_handler(event, context):
    user_id = event['user_id']

    # Try to read session (FAILS - different Lambda instance!)
    try:
        with open(f'/tmp/session_{user_id}.json', 'r') as f:
            session = json.load(f)
    except FileNotFoundError:
        return {'statusCode': 401, 'body': 'Unauthorized'}

# ✅ GOOD: Store state in DynamoDB or ElastiCache
def login_handler(event, context):
    user_id = authenticate(event['username'], event['password'])

    # Store session in DynamoDB
    sessions_table = dynamodb.Table('Sessions')
    sessions_table.put_item(
        Item={
            'user_id': user_id,
            'expires_at': int(time.time()) + 3600,
            'created_at': int(time.time())
        },
        ConditionExpression='attribute_not_exists(user_id)'
    )

    return {'statusCode': 200, 'body': json.dumps({'token': user_id})}

def get_profile_handler(event, context):
    user_id = event['user_id']

    # Read session from DynamoDB (works across all Lambda instances)
    response = sessions_table.get_item(Key={'user_id': user_id})

    if 'Item' not in response or response['Item']['expires_at'] < time.time():
        return {'statusCode': 401, 'body': 'Unauthorized'}

    return {'statusCode': 200, 'body': json.dumps(get_user_profile(user_id))}
```

### Anti-Pattern 3: Synchronous Chaining

**Problem**: Cascading failures and high latency.

```python
# ❌ BAD: Synchronous chain (A → B → C)
def function_a(event, context):
    result = process_a(event)

    # Invoke B synchronously
    response = lambda_client.invoke(
        FunctionName='function-b',
        InvocationType='RequestResponse',  # Synchronous
        Payload=json.dumps(result)
    )

    # Wait for B to complete before returning
    return json.loads(response['Payload'].read())

def function_b(event, context):
    result = process_b(event)

    # Invoke C synchronously
    response = lambda_client.invoke(
        FunctionName='function-c',
        InvocationType='RequestResponse',
        Payload=json.dumps(result)
    )

    return json.loads(response['Payload'].read())

# Problems:
# - User waits for A + B + C (300ms + 500ms + 200ms = 1 second)
# - If C fails, B fails, A fails (cascading failure)
# - A must wait for C (tight coupling)

# ✅ GOOD: Asynchronous with events
def function_a(event, context):
    result = process_a(event)

    # Publish event (asynchronous)
    eventbridge.put_events(
        Entries=[{
            'Source': 'service-a',
            'DetailType': 'ProcessingComplete',
            'Detail': json.dumps(result)
        }]
    )

    # Return immediately
    return {'statusCode': 202}

def function_b(event, context):
    """Triggered by ProcessingComplete event"""
    result = process_b(event['detail'])

    eventbridge.put_events(
        Entries=[{
            'Source': 'service-b',
            'DetailType': 'ProcessingComplete',
            'Detail': json.dumps(result)
        }]
    )

# Result: User gets response in 300ms, B and C run asynchronously
```

### Anti-Pattern 4: Not Using VPC Endpoints

**Problem**: NAT Gateway costs $0.045/hour + $0.045/GB data transfer ($43/month + data transfer).

```python
# ❌ BAD: Lambda in VPC without VPC endpoints
# Lambda → NAT Gateway → Internet Gateway → S3
# Cost: $43/month + $0.09/GB data transfer

# ✅ GOOD: Lambda in VPC with VPC endpoints
# Lambda → VPC Endpoint → S3 (private connection)
# Cost: $7/month (VPC endpoint) + $0 data transfer

# Create VPC endpoint for S3
ec2 = boto3.client('ec2')

ec2.create_vpc_endpoint(
    VpcId='vpc-0123456789abcdef0',
    ServiceName='com.amazonaws.us-east-1.s3',
    RouteTableIds=['rtb-0123456789abcdef0'],
    VpcEndpointType='Gateway'  # Free for S3 and DynamoDB
)

# Savings: $43 + data transfer costs eliminated
```

---

## Key Takeaways

**Core Principles**:
1. **Single responsibility functions**: One function, one task (faster cold starts, easier testing)
2. **Event-driven architecture**: Asynchronous communication via SNS/SQS/EventBridge (loose coupling)
3. **Idempotency**: Functions must handle duplicate events gracefully (use DynamoDB conditional writes)

**Event-Driven Patterns**:
4. **Pub/Sub (SNS)**: Fan-out messages to multiple consumers ($0.50 per million requests)
5. **Queue-based (SQS)**: Load leveling, guaranteed delivery, automatic retries ($0.40 per million)
6. **Event choreography (EventBridge)**: Complex workflows, event replay, content filtering ($1.00 per million)

**CQRS**:
7. **Separate read and write models**: Optimize independently (DynamoDB writes, ElastiCache reads)
8. **Denormalize for reads**: Store data in read-optimized format (faster queries, higher throughput)
9. **Use DynamoDB Streams**: Sync write model to read model asynchronously

**Observability**:
10. **Structured logging**: JSON logs for CloudWatch Logs Insights queries
11. **Distributed tracing**: X-Ray for end-to-end request visibility
12. **Embedded metrics**: Emit CloudWatch metrics from logs (zero latency, zero cost)

**Cost Optimization**:
13. **Right-size memory**: Higher memory = faster CPU, often cheaper total cost
14. **Provisioned concurrency**: Eliminate cold starts for latency-sensitive APIs ($27/month for 5 instances)
15. **DynamoDB On-Demand**: Use for <50M requests/month or unpredictable traffic
16. **S3 Intelligent-Tiering**: Auto-optimize storage costs (58% savings for cold data)

**Anti-Patterns**:
17. **Avoid long-running Lambda**: Use Step Functions or fan-out for >5 minute jobs
18. **Don't store state in /tmp**: Use DynamoDB or ElastiCache for session data
19. **Avoid synchronous chaining**: Use events for loose coupling and better resilience
20. **Use VPC endpoints**: Save $43/month + data transfer costs (eliminate NAT Gateway)

**Architecture Decisions**:
21. **SNS vs SQS vs EventBridge**: SNS for fan-out, SQS for queuing, EventBridge for complex routing
22. **DynamoDB vs RDS Aurora Serverless**: DynamoDB for key-value/document, Aurora for relational
23. **Lambda vs Fargate**: Lambda for <15min jobs, Fargate for long-running containers
24. **API Gateway REST vs HTTP**: HTTP API is 70% cheaper ($1.00 vs $3.50 per million requests)

Serverless architecture enables rapid development and automatic scaling, but requires event-driven thinking, careful observability, and cost optimization to succeed in production. Follow these patterns to build resilient, cost-effective serverless applications on AWS.
