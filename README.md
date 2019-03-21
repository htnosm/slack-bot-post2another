# slack-bot-post2another
Slack Bot of post to another channel

# Install

## Slack Incoming WebHook

- Set up Incoming WebHook for post channel

## Configure

- e.g.) profile = default, stage = dev

```bash
_PROFILE="default"
_STAGE="dev"
cp conf/serverless.env.yml.example conf/${_PROFILE}.${_STAGE}.yml
# Input slackChannel
vi conf/${_PROFILE}.${_STAGE}.yml
sls info --profile ${_PROFILE} --stage ${_STAGE}
```

### Initial deploy

```bash
sls deploy --profile ${_PROFILE} --stage ${_STAGE} --verbose

# Input KMSArn to awsKmsKeyArn
vi conf/${_PROFILE}.${_STAGE}.yml
```

#### KMS Key Setup

```bash
# Encrypt
_KEY_ID=$(grep 'awsKmsKeyArn:' conf/${_PROFILE}.${_STAGE}.yml | awk '{gsub(/"/,""); print $2}') ; echo ${_KEY_ID}
# URL (e.g. "hooks.slack.com/services/abc123").
_TEXTs=(
"Your Slack Incomming WebHook URL"
)
for _TEXT in ${_TEXTs[@]} ; do
  echo "-----"
  aws kms encrypt \
    --profile ${_PROFILE} \
    --key-id "${_KEY_ID}" \
    --plaintext "${_TEXT}" \
    --output text --query CiphertextBlob
  echo "-----"
done

# Input Encrypted Keys (kmsEncryptedHookUrl)
vi conf/${_PROFILE}.${_STAGE}.yml

# Check
_ENCRYPTEDs=(
"$(grep 'kmsEncryptedHookUrl:' conf/${_PROFILE}.${_STAGE}.yml | awk '{gsub(/"/,""); print $2}')"
)
for _TEXT in ${_ENCRYPTEDs[@]} ; do
  echo "-----"
  aws kms decrypt \
    --profile ${_PROFILE} \
    --ciphertext-blob fileb://<(echo "${_TEXT}" | base64 --decode) \
    --output text --query Plaintext \
    | base64 --decode ; echo ""
  echo "-----"
done
```

### Deploy

```bash
sls deploy -f post --profile ${_PROFILE} --stage ${_STAGE} --verbose
```

#### Test Invoke

```bash
sls invoke -f post -l --profile ${_PROFILE} --stage ${_STAGE} --verbose
```

#### Remove

```bash
sls remove --profile ${_PROFILE} --stage ${_STAGE} --verbose
```

## Slack Outgoing WebHooks

- Set up Outgoing WebHook for source channel
  - Channel: Listen channel
  - Trigger Word: Listen word
  - URL: API Gateway endpoint
