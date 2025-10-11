"""
Management command to generate slugs for all models that support them
"""
from django.core.management.base import BaseCommand
from django.apps import apps
from django.utils.text import slugify
from django.db import transaction
from django.db import models as django_models
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Generate slugs for all models that support them'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--models',
            nargs='+',
            type=str,
            help='Specific models to process (e.g., Event Publication Press)'
        )
        parser.add_argument(
            '--apps',
            nargs='+',
            type=str,
            help='Specific Django apps to process (e.g., event publications press)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be generated without saving'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of objects to process per batch (default: 100)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate slugs even if they already exist'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed progress information'
        )
    
    def handle(self, *args, **options):
        """Main command handler"""
        models_to_process = options.get('models')
        apps_to_process = options.get('apps')
        dry_run: bool = bool(options.get('dry_run', False))
        batch_size: int = int(options.get('batch_size', 100))
        force: bool = bool(options.get('force', False))
        verbose: bool = bool(options.get('verbose', False))
        
        self.stdout.write(
            self.style.SUCCESS('🚀 Universal Slug Generation System Starting...')
        )
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('🔍 DRY RUN MODE - No changes will be saved')
            )
        
        # Find all models that inherit from SlugBaseModel
        slug_models = self.find_slug_models(models_to_process, apps_to_process)
        
        if not slug_models:
            self.stdout.write(
                self.style.ERROR('❌ No models with slug support found')
            )
            return
        
        self.stdout.write(
            f"📋 Found {len(slug_models)} models with slug support:"
        )
        for model in slug_models:
            self.stdout.write(f"   • {model._meta.app_label}.{model.__name__}")
        
        # Process each model
        total_processed = 0
        total_updated = 0
        
        for model in slug_models:
            try:
                processed, updated = self.process_model(
                    model, dry_run, batch_size, force, verbose
                )
                total_processed += processed
                total_updated += updated
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"❌ Error processing {model.__name__}: {str(e)}"
                    )
                )
                if verbose:
                    logger.exception(f"Error processing {model.__name__}")
        
        # Final summary
        self.stdout.write(
            self.style.SUCCESS(
                f"✅ Slug generation complete!\n"
                f"   📊 Total objects processed: {total_processed}\n"
                f"   🔄 Total objects updated: {total_updated}\n"
                f"   🎯 Success rate: {(total_updated/total_processed*100) if total_processed > 0 else 0:.1f}%"
            )
        )
    
    def find_slug_models(self, model_names: Optional[List[str]] = None, app_names: Optional[List[str]] = None) -> List[Any]:
        """Find all models that inherit from SlugBaseModel"""
        slug_models = []
        
        for model in apps.get_models():
            # Check if model has slug support
            if not (hasattr(model, 'slug') and hasattr(model, 'generate_slug_base')):
                continue
            
            # Filter by specific models if provided
            if model_names and model.__name__ not in model_names:
                continue
            
            # Filter by specific apps if provided
            if app_names and model._meta.app_label not in app_names:
                continue
            
            slug_models.append(model)
        
        return slug_models
    
    def process_model(self, model, dry_run: bool = False, batch_size: int = 100, 
                     force: bool = False, verbose: bool = False) -> tuple:
        """Process a single model"""
        model_name = model.__name__
        app_label = model._meta.app_label
        
        self.stdout.write(f"\n🔧 Processing {app_label}.{model_name}...")
        
        # Build queryset
        if force:
            # Process all objects if force is True
            queryset = model.objects.all()
        else:
            # Only process objects without slugs
            queryset = model.objects.filter(
                django_models.Q(slug__isnull=True) | django_models.Q(slug='')
            )
        
        total_count = queryset.count()
        
        if total_count == 0:
            self.stdout.write(f"   ✓ {model_name}: No objects need slug generation")
            return 0, 0
        
        self.stdout.write(f"   📋 Found {total_count} objects to process")
        
        processed = 0
        updated = 0
        
        # Process in batches
        for i in range(0, total_count, batch_size):
            batch = queryset[i:i+batch_size]
            
            if verbose:
                self.stdout.write(f"   🔄 Processing batch {i//batch_size + 1}...")
            
            batch_updated = self.process_batch(batch, dry_run, verbose, model_name)
            processed += len(batch)
            updated += batch_updated
            
            # Progress indicator
            if not verbose and processed % (batch_size * 10) == 0:
                self.stdout.write(f"   📈 Progress: {processed}/{total_count}")
        
        success_rate = (updated/processed*100) if processed > 0 else 0
        
        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"   ✅ {model_name}: Updated {updated}/{processed} objects ({success_rate:.1f}%)"
                )
            )
        else:
            self.stdout.write(
                f"   🔍 {model_name}: Would update {updated}/{processed} objects ({success_rate:.1f}%)"
            )
        
        return processed, updated
    
    def process_batch(self, batch, dry_run: bool, verbose: bool, model_name: str) -> int:
        """Process a batch of objects"""
        updated_count = 0
        
        for obj in batch:
            try:
                old_slug = obj.slug
                
                # Generate new slug
                new_slug = obj.generate_fresh_slug()
                
                if old_slug != new_slug:
                    if not dry_run:
                        # Save with transaction safety
                        with transaction.atomic():
                            obj.slug = new_slug
                            obj.save(update_fields=['slug'])
                    
                    updated_count += 1
                    
                    if verbose:
                        self.stdout.write(
                            f"     🔄 {obj.id}: '{old_slug or 'None'}' → '{new_slug}'"
                        )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"     ❌ Error processing {model_name} #{obj.id}: {str(e)}"
                    )
                )
                logger.exception(f"Error processing {model_name} #{obj.id}")
        
        return updated_count
    
    def get_model_stats(self, models: List[Any]) -> Dict[str, Any]:
        """Get statistics about slug coverage across models"""
        stats = {
            'total_models': len(models),
            'models_with_slugs': 0,
            'total_objects': 0,
            'objects_with_slugs': 0,
            'coverage_percentage': 0.0
        }
        
        for model in models:
            total_objects = model.objects.count()
            objects_with_slugs = model.objects.exclude(
                django_models.Q(slug__isnull=True) | django_models.Q(slug='')
            ).count()
            
            stats['total_objects'] += total_objects
            stats['objects_with_slugs'] += objects_with_slugs
            
            if objects_with_slugs > 0:
                stats['models_with_slugs'] += 1
        
        if stats['total_objects'] > 0:
            stats['coverage_percentage'] = (
                stats['objects_with_slugs'] / stats['total_objects'] * 100
            )
        
        return stats
