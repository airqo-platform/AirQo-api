# Generated by Django 4.2.16 on 2024-10-19 15:18

import utils.fields
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django_quill.fields


class Migration(migrations.Migration):

    initial = True

    operations = [
        migrations.CreateModel(
            name='CleanAirResource',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_title', models.CharField(max_length=120)),
                ('resource_link', models.URLField(blank=True, null=True)),
                ('resource_file', utils.fields.CustomFileField(
                    blank=True, default='uploads/default_file.txt', null=True, upload_to='uploads/files/')),
                ('author_title', models.CharField(blank=True,
                 default='Created By', max_length=40, null=True)),
                ('resource_category', models.CharField(choices=[('toolkit', 'ToolKit'), ('technical_report', 'Technical Report'), (
                    'workshop_report', 'Workshop Report'), ('research_publication', 'Research Publication')], default='technical_report', max_length=40)),
                ('resource_authors', models.CharField(
                    default='AirQo', max_length=200)),
                ('order', models.IntegerField(default=1)),
            ],
            options={
                'ordering': ['order', '-id'],
            },
        ),
        migrations.CreateModel(
            name='Engagement',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='ForumEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(default='CLEAN-Air Forum', max_length=100)),
                ('title_subtext', models.TextField(blank=True)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField(blank=True, null=True)),
                ('start_time', models.TimeField(blank=True, null=True)),
                ('end_time', models.TimeField(blank=True, null=True)),
                ('introduction', django_quill.fields.QuillField(blank=True, null=True)),
                ('speakers_text_section', django_quill.fields.QuillField(
                    blank=True, null=True)),
                ('committee_text_section',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('partners_text_section', django_quill.fields.QuillField(
                    blank=True, null=True)),
                ('registration_link', models.URLField(blank=True)),
                ('schedule_details', django_quill.fields.QuillField(
                    blank=True, null=True)),
                ('registration_details', django_quill.fields.QuillField(
                    blank=True, null=True)),
                ('sponsorship_opportunities_about',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('sponsorship_opportunities_schedule',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('sponsorship_opportunities_partners',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('sponsorship_packages', django_quill.fields.QuillField(
                    blank=True, null=True)),
                ('travel_logistics_vaccination_details',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('travel_logistics_visa_details',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('travel_logistics_accommodation_details',
                 django_quill.fields.QuillField(blank=True, null=True)),
                ('glossary_details', django_quill.fields.QuillField(
                    blank=True, null=True)),
                ('unique_title', models.CharField(blank=True, max_length=100)),
                ('background_image', utils.fields.CustomImageField(
                    blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/')),
                ('location_name', models.CharField(blank=True, max_length=100)),
                ('location_link', models.URLField(blank=True)),
                ('order', models.IntegerField(default=1)),

            ],
            options={
                'ordering': ['order', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ForumResource',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_title', models.CharField(max_length=120)),
                ('resource_authors', models.CharField(
                    default='AirQo', max_length=200)),
                ('order', models.IntegerField(default=1)),
                ('forum_event', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                 related_name='forum_resources', to='cleanair.forumevent')),
            ],
            options={
                'ordering': ['order', '-id'],
            },
        ),
        migrations.CreateModel(
            name='Program',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=100)),
                ('sub_text', django_quill.fields.QuillField(blank=True, null=True)),
                ('order', models.IntegerField(default=1)),

                ('forum_event', models.ForeignKey(blank=True, null=True,
                 on_delete=django.db.models.deletion.SET_NULL, related_name='programs', to='cleanair.forumevent')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='Support',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('query', models.CharField(max_length=80)),
                ('name', models.CharField(max_length=70)),
                ('role', models.CharField(blank=True, max_length=100)),
                ('email', models.EmailField(max_length=254)),
                ('order', models.IntegerField(default=1)),
                ('event', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                 related_name='supports', to='cleanair.forumevent')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='Session',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('start_time', models.TimeField(blank=True, null=True)),
                ('end_time', models.TimeField(null=True)),
                ('session_title', models.CharField(max_length=150)),
                ('session_details', django_quill.fields.QuillField(null=True)),
                ('order', models.IntegerField(default=1)),

                ('program', models.ForeignKey(blank=True, null=True,
                 on_delete=django.db.models.deletion.SET_NULL, related_name='sessions', to='cleanair.program')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='ResourceSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('session_title', models.CharField(max_length=120)),
                ('order', models.IntegerField(default=1)),
                ('forum_resource', models.ForeignKey(default=1, on_delete=django.db.models.deletion.CASCADE,
                 related_name='resource_sessions', to='cleanair.forumresource')),
            ],
            options={
                'ordering': ['order', '-id'],
            },
        ),
        migrations.CreateModel(
            name='ResourceFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('resource_summary', models.TextField(blank=True, null=True)),
                ('file', utils.fields.CustomFileField(
                    blank=True, default='uploads/default_file.txt', null=True, upload_to='uploads/files/')),
                ('order', models.IntegerField(default=1)),
                ('session', models.ForeignKey(blank=True, default=1, null=True, on_delete=django.db.models.deletion.CASCADE,
                 related_name='resource_files', to='cleanair.resourcesession')),
            ],
            options={
                'ordering': ['order', '-id'],
            },
        ),
        migrations.CreateModel(
            name='Person',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('title', models.CharField(blank=True, max_length=100)),
                ('bio', django_quill.fields.QuillField(blank=True, null=True)),
                ('category', models.CharField(choices=[('Speaker', 'SPEAKER'), ('Committee Member', 'COMMITTEE_MEMBER'), ('Key Note Speaker', 'KEY_NOTE_SPEAKER'), (
                    'Speaker and Committee Member', 'SPEAKER_AND_COMMITTEE_MEMBER'), ('Committee Member and Key Note Speaker', 'COMMITTEE_MEMBER_AND_KEY_NOTE_SPEAKER')], default='Speaker', max_length=50)),
                ('picture', utils.fields.CustomImageField(
                    blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/')),
                ('twitter', models.URLField(blank=True)),
                ('linked_in', models.URLField(blank=True)),
                ('order', models.IntegerField(default=1)),
                ('forum_event', models.ForeignKey(blank=True, null=True,
                 on_delete=django.db.models.deletion.SET_NULL, related_name='persons', to='cleanair.forumevent')),
            ],
            options={
                'ordering': ['order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='Partner',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('partner_logo', utils.fields.CustomImageField(
                    blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/')),
                ('name', models.CharField(max_length=70)),
                ('website_link', models.URLField(blank=True, null=True)),
                ('order', models.IntegerField(default=1)),
                ('category', models.CharField(choices=[('Funding Partner', 'FUNDING_PARTNER'), ('Host Partner', 'HOST_PARTNER'), (
                    'Co-Convening Partner', 'CO_CONVENING_PARTNER'), ('Sponsor Partner', 'SPONSOR_PARTNER')], default='Funding Partner', max_length=50)),

                ('forum_event', models.ForeignKey(blank=True, null=True,
                 on_delete=django.db.models.deletion.SET_NULL, related_name='partners', to='cleanair.forumevent')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.CreateModel(
            name='Objective',
            fields=[
                ('id', models.BigAutoField(auto_created=True,
                 primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('details', models.TextField(blank=True, null=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('engagement', models.ForeignKey(blank=True, null=True,
                 on_delete=django.db.models.deletion.CASCADE, related_name='objectives', to='cleanair.engagement')),
            ],
            options={
                'ordering': ['order'],
            },
        ),
        migrations.AddField(
            model_name='engagement',
            name='forum_event',
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                       related_name='engagements', to='cleanair.forumevent'),
        ),
    ]
