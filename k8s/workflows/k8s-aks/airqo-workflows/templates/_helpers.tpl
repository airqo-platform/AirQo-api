{{/*
Expand the name of the chart.
*/}}
{{- define "airqo-workflows.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "airqo-workflows.fullname" -}}
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
{{- define "airqo-workflows.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "airqo-workflows.labels" -}}
helm.sh/chart: {{ include "airqo-workflows.chart" . }}
{{ include "airqo-workflows.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "airqo-workflows.selectorLabels" -}}
app.kubernetes.io/name: {{ include "airqo-workflows.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "airqo-workflows.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "airqo-workflows.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

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
Get port(8080) by name.
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
Get nodePort(30036) by name.
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
Get protocol by service name.
*/}}
{{- define "getProtocolBySvcName" -}}
{{- $context := index . 0 -}}
{{- $protocolSvcName := index . 1 -}}
{{- range $context.Values.service.ports -}}
  {{- if eq .name $protocolSvcName -}}
    {{- .protocol -}}
  {{- end -}}
{{- end -}}
{{- end }}
