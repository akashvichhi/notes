<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('folder_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 255)->default('');
            $table->boolean('title_locked')->default(false);
            $table->json('body')->nullable();          // JSON columns cannot have a DEFAULT
            $table->longText('plain_text')->nullable();
            $table->string('excerpt', 200)->default('');
            $table->boolean('is_starred')->default(false);
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('word_count')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['user_id', 'deleted_at', 'updated_at']);
            $table->index(['user_id', 'folder_id', 'deleted_at']);
            $table->index(['user_id', 'is_starred', 'deleted_at']);
        });

        // FULLTEXT must be added separately: the Blueprint helper is fine, but keep it
        // in its own statement so the index name is predictable.
        DB::statement('ALTER TABLE notes ADD FULLTEXT ft_notes (title, plain_text)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
