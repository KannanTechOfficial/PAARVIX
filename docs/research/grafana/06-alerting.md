# 6. Alerting

## Pipeline [O]

```
Rule (folder + group + interval)
  A query -> B reduce -> C threshold (condition: C)
  -> alert instance state stored
  -> notification policy (route tree)
  -> contact point -> channel
```

Rule created through `POST /api/v1/provisioning/alert-rules` and stamped `provenance: api`. Fields: `title`, `ruleGroup`, `folderUID`, `for`, `noDataState`, `execErrState`, `condition`, `data[]`.

Each data item has `refId`, `datasourceUid`, `relativeTimeRange`, `model`. Expressions use `__expr__`.

## Storage [O]

`alert_rule`, `alert_rule_version`, `alert_instance`, `alert_rule_state`, `alert_configuration`, `alert_configuration_history`, `alert_image`, `provenance_type`.

Rules and notification config both keep history.

## Routing [O]

- Alertmanager config has `receivers` and `route`.
- Default policy groups by `grafana_folder` + `alertname`.
- Default receiver was `empty`, and the contact-points API returned an empty list. **A new rule notifies nobody until someone configures this.**
- Permissions confirm silences, time intervals, templates, inhibition rules.

## Channels [O]

LINE, DingDing, Discord, email, Google Chat, Jira, Kafka, MQTT, OnCall, Opsgenie, PagerDuty, Alertmanager, Pushover, Sensu Go, Slack, SNS, Teams, Telegram, Threema, VictorOps, Webex, webhook, WeCom.

**WhatsApp and SMS are not listed.**

## Other [O]

Prometheus rule import (`/convert/prometheus`, 14 operations), recording rules (8 API operations; not tested), state history, optional screenshots via renderer.

**Not tested:** evaluation timing, firing, delivery, silences.

## For Paarvix [R]

- Copy the three-step idea, but hide it: "attendance below 75%" produces the pipeline.
- Wizard must require a recipient before saving a rule.
- Email in P1; WhatsApp is the headline Pro channel.
- Keep provenance and history on rules.
- Skip route trees until P3; one rule → recipients list suits colleges.
