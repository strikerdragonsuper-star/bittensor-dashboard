from app.models import NeuronRecord


def is_miner_neuron(neuron: NeuronRecord) -> bool:
    """Miners include inactive UIDs that still receive mining emissions."""
    if neuron.is_owner or neuron.is_validator:
        return False
    return neuron.active or neuron.incentive > 0 or neuron.daily_income > 0 or neuron.emission > 0
