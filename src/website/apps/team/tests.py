from django.test import TestCase

from apps.api.v2.serializers.team import MemberDetailSerializer, MemberListSerializer
from apps.team.models import Member
from apps.team.serializers import TeamMemberSerializer


class MemberCategoryTests(TestCase):
    def test_member_category_defaults_to_staff(self):
        member = Member.objects.create(name="Test Member", title="Engineer")
        self.assertEqual(member.category, Member.MemberCategory.STAFF)

    def test_member_category_is_exposed_in_serializers(self):
        member = Member.objects.create(
            name="Another Member",
            title="Research Fellow",
            category=Member.MemberCategory.FELLOW,
        )

        self.assertEqual(TeamMemberSerializer(member).data["category"], "fellow")
        self.assertEqual(MemberListSerializer(member).data["category"], "fellow")
        self.assertEqual(MemberDetailSerializer(member).data["category"], "fellow")
