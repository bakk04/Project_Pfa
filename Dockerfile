FROM python:3.10-slim

# Créer un utilisateur non-root pour Hugging Face
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Copier les fichiers et donner la propriété à l'utilisateur
COPY --chown=user ./requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user . /app

# Lancer l'application
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
