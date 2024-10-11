{{/*
Expand the name of the chart.
*/}}
{{- define "workflows.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "workflows.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "workflows.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "workflows.labels" -}}
helm.sh/chart: {{ include "workflows.chart" . }}
{{ include "workflows.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "workflows.selectorLabels" -}}
app.kubernetes.io/name: {{ include "workflows.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "workflows.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "workflows.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Added to get specific service ports
*/}}

{{/*
Get targetPort(8080) by name.
*/}}
{{- define "getTargetPortByName" -}}
{{- $context := index . 0 -}}
{{- $targetPortName := index . 1 -}}
{{- range $context.Values.service.ports -}}
  {{- if eq .name $targetPortName -}}
    {{- .targetPort -}}
  {{- end -}}
{{- end -}}
{{- end }}

{{/*
Get port(80) by name
*/}}
{{- define "getPortByName" -}}
{{- $context := index . 0 -}}
{{- $portName := index . 1 -}}
{{- range $context.Values.service.ports -}}
  {{- if eq .name $portName -}}
    {{- .port -}}
  {{- end -}}
{{- end -}}
{{- end }}

{{/*
Get node port(30080) by name
*/}}
{{- define "getNodePortByName" -}}
{{- $context := index . 0 -}}
{{- $nodePortName := index . 1 -}}
{{- range $context.Values.service.ports -}}
  {{- if eq .name $nodePortName -}}
    {{- .nodePort -}}
  {{- end -}}
{{- end -}}
{{- end }}

{{/*
Get protocol by service name
*/}}
{{- define "getProtocolBySvcName" -}}
{{- $context := index . 0 -}}
{{- $protocol := index . 1 -}}
{{- range $context.Values.service.ports -}}
  {{- if eq .name $protocol -}}
    {{- .protocol -}}
  {{- end -}}
{{- end -}}
{{- end }}
