from django import forms

from .models import LivePublicationFeedSettings


class LivePublicationFeedSettingsAdminForm(forms.ModelForm):
    """Plain-language controls for the communications team."""

    class Meta:
        model = LivePublicationFeedSettings
        fields = "__all__"
        labels = {
            "enabled": "Show live AirQo publications on the website",
            "openalex_author_ids": "AirQo researcher IDs (OpenAlex)",
            "allowed_affiliations": "Affiliations to include",
            "relevance_keywords": "Research topics to include",
            "relevance_required": "Require an AirQo or topic match",
            "openalex_api_url": "OpenAlex works endpoint",
            "crossref_api_url": "Crossref works endpoint",
            "crossref_mailto": "Crossref contact email",
        }
        help_texts = {
            "enabled": (
                "Turn this off to pause provider-supplied publications. "
                "Curated AirQo publications already managed in Publications remain visible."
            ),
            "openalex_author_ids": (
                "Enter one OpenAlex researcher ID per line. These IDs decide which "
                "AirQo researchers are searched. Example: A5047583981."
            ),
            "allowed_affiliations": (
                "Enter one affiliation per line. These values are used for Crossref "
                "searches and provider-result matching. Usually this includes AirQo."
            ),
            "relevance_keywords": (
                "Enter one topic or phrase per line. A result is included when its "
                "title or abstract matches one of these terms."
            ),
            "relevance_required": (
                "When selected, a live result must match an included affiliation or "
                "research topic before it appears on the website."
            ),
            "openalex_api_url": (
                "Keep this on the official OpenAlex HTTPS works endpoint. "
                "The OpenAlex API key is kept on the server and is not entered here."
            ),
            "crossref_api_url": (
                "Keep this on the official Crossref HTTPS works endpoint."
            ),
            "crossref_mailto": (
                "Contact email sent to Crossref for polite-pool access; this is not an API key."
            ),
        }
        widgets = {
            "openalex_author_ids": forms.Textarea(attrs={"rows": 6}),
            "allowed_affiliations": forms.Textarea(attrs={"rows": 5}),
            "relevance_keywords": forms.Textarea(attrs={"rows": 8}),
        }
