{{/*
Create service name as used by the service name label.
*/}}
{{- define "service.fullname" -}}
{{- printf "%s-%s-%s" .Release.Name .Chart.Name "service" | indent 1 }}
{{- end }}

{{/*
Create configmap name as used by the service name label.
*/}}
{{- define "configmap.fullname" -}}
{{- printf "%s-%s-%s" .Release.Name .Chart.Name "configmap" | indent 1 }}
{{- end }}

{{/*
Create deployment name as used by the service name label.
*/}}
{{- define "deployment.fullname" -}}
{{- printf "%s-%s-%s" .Release.Name .Chart.Name "deployment" | indent 1 }}
{{- end }}
